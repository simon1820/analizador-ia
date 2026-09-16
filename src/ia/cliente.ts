/**
 * Construye el cliente de Claude según el proveedor configurado.
 *
 * - bedrock:   firma SigV4 con la cadena de credenciales de AWS (en EC2, el
 *              rol de la instancia; en local, el perfil de AWS CLI).
 * - anthropic: API de Anthropic directa. La clave se lee cifrada de
 *              Parameter Store con esas mismas credenciales.
 *
 * En ningún caso hay claves en el código ni en el repositorio.
 */

import Anthropic from "@anthropic-ai/sdk";
import { AnthropicBedrockMantle } from "@anthropic-ai/bedrock-sdk";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { config } from "../config.js";

export type ClienteIa = Anthropic | AnthropicBedrockMantle;

async function leerClaveAnthropic(): Promise<string> {
  // Atajo para desarrollo local; en producción no se define.
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;

  const ssm = new SSMClient({ region: config.awsRegion });
  const res = await ssm.send(new GetParameterCommand({ Name: config.parametroClave, WithDecryption: true }));
  const clave = res.Parameter?.Value;
  if (!clave) throw new Error(`El parámetro ${config.parametroClave} está vacío.`);
  return clave;
}

export async function crearCliente(): Promise<ClienteIa> {
  const opciones = { timeout: config.tiempoMaximoIa, maxRetries: 2 };

  if (config.proveedor === "anthropic") {
    return new Anthropic({
      apiKey: await leerClaveAnthropic(),
      // Una clave creada a nivel de organización exige indicar el workspace.
      ...(config.workspaceId ? { defaultHeaders: { "anthropic-workspace-id": config.workspaceId } } : {}),
      ...opciones,
    });
  }

  return new AnthropicBedrockMantle({ awsRegion: config.awsRegion, ...opciones });
}
