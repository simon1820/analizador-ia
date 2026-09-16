/**
 * Punto de entrada. Arma el estado del proceso, monta las rutas y gestiona
 * el ciclo de vida (arranque y apagado limpio).
 */

import express from "express";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { leerIdentidad } from "./identidad.js";
import { crearCliente } from "./ia/cliente.js";
import { crearRutas, type Estado } from "./rutas.js";

const estado: Estado = {
  identidad: await leerIdentidad(),
  cliente: await crearCliente(),
  saludable: true,
};

if (estado.identidad.entorno === "ec2") {
  console.log(`Identidad EC2: ${estado.identidad.instanceId} en ${estado.identidad.availabilityZone}`);
} else {
  console.log("Sin metadatos de EC2: se asume ejecución local.");
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));
app.use(express.static(fileURLToPath(new URL("../public/", import.meta.url))));
app.use(crearRutas(estado));

const servidor = app.listen(config.puerto, () => {
  console.log(
    `Escuchando en el puerto ${config.puerto} (${estado.identidad.entorno}). IA: ${config.proveedor}, modelo ${config.modelo}.`,
  );
});

// systemd manda SIGTERM al reiniciar o reemplazar la instancia: se dejan
// terminar las peticiones en curso en vez de cortarlas.
for (const señal of ["SIGTERM", "SIGINT"] as const) {
  process.on(señal, () => {
    console.log(`${señal} recibida, cerrando.`);
    servidor.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
