import express from "express";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = Number(process.env.PORT ?? 3000);
const IMDS = "http://169.254.169.254";

type Identidad = {
  instanceId: string;
  availabilityZone: string;
  instanceType: string;
  entorno: "ec2" | "local";
};

let identidad: Identidad = {
  instanceId: "local",
  availabilityZone: "local",
  instanceType: "local",
  entorno: "local",
};

// Interruptor manual para romper el health check a propósito.
// Sirve para ver al balanceador sacar esta instancia de rotación.
let saludable = true;

/**
 * Lee los metadatos de la instancia usando IMDSv2 (el flujo con token).
 * IMDSv1 sin token está desactivado por defecto en las AMIs nuevas: es
 * la vía por la que históricamente se filtraban credenciales vía SSRF.
 */
async function leerMetadatos(): Promise<void> {
  try {
    const resToken = await fetch(`${IMDS}/latest/api/token`, {
      method: "PUT",
      headers: { "x-aws-ec2-metadata-token-ttl-seconds": "300" },
      signal: AbortSignal.timeout(1500),
    });
    if (!resToken.ok) throw new Error(`token: ${resToken.status}`);
    const token = await resToken.text();

    const pedir = async (ruta: string): Promise<string> => {
      const res = await fetch(`${IMDS}/latest/meta-data/${ruta}`, {
        headers: { "x-aws-ec2-metadata-token": token },
        signal: AbortSignal.timeout(1500),
      });
      if (!res.ok) throw new Error(`${ruta}: ${res.status}`);
      return res.text();
    };

    identidad = {
      instanceId: await pedir("instance-id"),
      availabilityZone: await pedir("placement/availability-zone"),
      instanceType: await pedir("instance-type"),
      entorno: "ec2",
    };
    console.log(`Identidad EC2: ${identidad.instanceId} en ${identidad.availabilityZone}`);
  } catch {
    console.log("Sin metadatos de EC2: se asume ejecución local.");
  }
}

app.use(express.json({ limit: "64kb" }));
app.use(express.static(fileURLToPath(new URL("../public/", import.meta.url))));

// El balanceador consulta esta ruta. Un 503 saca la instancia de rotación.
app.get("/health", (_req, res) => {
  res.status(saludable ? 200 : 503).json({ saludable, ...identidad });
});

app.get("/api/identidad", (_req, res) => {
  res.json({ ...identidad, saludable, hora: new Date().toISOString() });
});

// Sólo para la demo del balanceador. En una app real esto no existe.
app.post("/api/salud", (req, res) => {
  const { activa } = req.body as { activa?: unknown };
  if (typeof activa !== "boolean") {
    res.status(400).json({ error: 'Envía { "activa": true } o { "activa": false }.' });
    return;
  }
  saludable = activa;
  console.log(`Health check ahora responde ${saludable ? "200" : "503"}.`);
  res.json({ saludable });
});

app.post("/api/analizar", (req, res) => {
  const { texto } = req.body as { texto?: unknown };
  if (typeof texto !== "string" || texto.trim().length === 0) {
    res.status(400).json({ error: "Escribe un texto para analizar." });
    return;
  }
  // Fase 2: aquí entra la llamada a Amazon Bedrock.
  res.json({
    pendiente: true,
    mensaje: "El modelo de IA se conecta en la fase 2. Por ahora sólo verificamos el despliegue.",
    caracteres: texto.trim().length,
    atendidoPor: identidad.instanceId,
  });
});

await leerMetadatos();
app.listen(PORT, () => {
  console.log(`Escuchando en el puerto ${PORT} (${identidad.entorno}).`);
});