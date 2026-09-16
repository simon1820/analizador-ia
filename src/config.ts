/**
 * Configuración leída del entorno, en un solo sitio.
 * En EC2 la fija el servicio systemd (ver infra/user-data.sh.tftpl);
 * en local se toma del perfil de AWS CLI y de variables sueltas.
 */

export type Proveedor = "bedrock" | "anthropic";

function leerProveedor(): Proveedor {
  const valor = process.env.IA_PROVEEDOR ?? "anthropic";
  if (valor !== "bedrock" && valor !== "anthropic") {
    throw new Error(`IA_PROVEEDOR debe ser "bedrock" o "anthropic", no "${valor}".`);
  }
  return valor;
}

const proveedor = leerProveedor();

// Sonnet 5 resuelve bien clasificar y resumir textos cortos a una fracción
// del costo de Opus. Se cambia con IA_MODELO (Terraform: var.ia_modelo).
const MODELO_POR_DEFECTO: Record<Proveedor, string> = {
  anthropic: "claude-sonnet-5",
  bedrock: "anthropic.claude-sonnet-5",
};

export const config = {
  puerto: Number(process.env.PORT ?? 3000),
  awsRegion: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1",
  proveedor,
  modelo: process.env.IA_MODELO || MODELO_POR_DEFECTO[proveedor],
  /** Nombre del parámetro SecureString en SSM con la clave de Anthropic. */
  parametroClave: process.env.ANTHROPIC_API_KEY_PARAM ?? "/analizador-ia/anthropic-api-key",
  /** Sólo para claves de organización no ligadas a un workspace. */
  workspaceId: process.env.ANTHROPIC_WORKSPACE_ID || undefined,
  maxCaracteres: 8000,
  /** Tiempo máximo de una llamada al modelo, en milisegundos. */
  tiempoMaximoIa: 60_000,
} as const;
