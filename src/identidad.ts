/**
 * Identidad de la instancia EC2 que ejecuta el proceso, leída de IMDSv2.
 * Sirve para que cada respuesta lleve la firma del servidor que la atendió
 * y así ver el balanceo de carga en acción.
 */

const IMDS = "http://169.254.169.254";
const TIEMPO_MAXIMO = 1500;

export type Identidad = {
  instanceId: string;
  availabilityZone: string;
  instanceType: string;
  entorno: "ec2" | "local";
};

const LOCAL: Identidad = {
  instanceId: "local",
  availabilityZone: "local",
  instanceType: "local",
  entorno: "local",
};

/**
 * Usa el flujo con token de IMDSv2. IMDSv1 sin token está desactivado por
 * defecto en las AMIs nuevas: es la vía por la que históricamente se
 * filtraban credenciales vía SSRF. Fuera de EC2 devuelve la identidad local.
 */
export async function leerIdentidad(): Promise<Identidad> {
  try {
    const resToken = await fetch(`${IMDS}/latest/api/token`, {
      method: "PUT",
      headers: { "x-aws-ec2-metadata-token-ttl-seconds": "300" },
      signal: AbortSignal.timeout(TIEMPO_MAXIMO),
    });
    if (!resToken.ok) throw new Error(`token: ${resToken.status}`);
    const token = await resToken.text();

    const pedir = async (ruta: string): Promise<string> => {
      const res = await fetch(`${IMDS}/latest/meta-data/${ruta}`, {
        headers: { "x-aws-ec2-metadata-token": token },
        signal: AbortSignal.timeout(TIEMPO_MAXIMO),
      });
      if (!res.ok) throw new Error(`${ruta}: ${res.status}`);
      return res.text();
    };

    return {
      instanceId: await pedir("instance-id"),
      availabilityZone: await pedir("placement/availability-zone"),
      instanceType: await pedir("instance-type"),
      entorno: "ec2",
    };
  } catch {
    return LOCAL;
  }
}
