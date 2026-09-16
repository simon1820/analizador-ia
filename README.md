# Analizador de reseñas

Ejercicio de despliegue en AWS. Una app en Express + TypeScript que
analiza textos de clientes (reseñas, tickets, correos) con Claude a través
de Amazon Bedrock y devuelve sentimiento, puntuación, temas, urgencia y una
respuesta sugerida. Cada respuesta lleva la firma de la instancia EC2 que
la atendió, y un interruptor permite tumbar su health check para ver cómo
el balanceador la saca de rotación.

## Fase 2: el modelo

La app usa el SDK de Anthropic y admite dos proveedores, elegidos con
`var.ia_proveedor` en Terraform (llega a la instancia como `IA_PROVEEDOR`):

| Proveedor | Cómo se autentica | Modelo por defecto |
|---|---|---|
| `anthropic` | Clave de la API de Anthropic guardada cifrada en Parameter Store; la instancia la lee con su rol | `claude-opus-5` |
| `bedrock` | Firma SigV4 con el rol de la instancia, sin clave | `anthropic.claude-opus-4-8` |

El modelo se cambia con `var.ia_modelo`. No hay claves en el código ni en
el repositorio.

**Proveedor `anthropic`.** Guardar la clave una sola vez, a mano, en la
región del despliegue:

```bash
aws ssm put-parameter --name /analizador-ia/anthropic-api-key \
  --type SecureString --value "sk-ant-..." --region us-east-1
```

**Proveedor `bedrock`.** Hay que habilitar los modelos de Anthropic en la
cuenta (Bedrock, catálogo de modelos, formulario de caso de uso) y la cuenta
debe estar en un plan de pago: en el plan gratuito de AWS la cuota diaria
de tokens de Bedrock es cero.

En cualquiera de los dos casos, mientras falte algo el endpoint responde
503 con el motivo. La respuesta del modelo se pide como llamada a una
herramienta con esquema fijo, así llega como JSON validable y no como
texto libre.

## Arquitectura

![Arquitectura en AWS](docs/arquitectura.svg)

**Tráfico de usuario.** El navegador entra por HTTP al Application Load
Balancer, que reparte las peticiones entre dos instancias EC2 repartidas en
dos zonas de disponibilidad. El balanceador consulta `/health` cada diez
segundos y deja de enviar tráfico a una instancia que responda 503.

**Ciclo de vida de las instancias.** Un Auto Scaling Group mantiene dos
instancias t3.micro. Cada una, al arrancar, clona este repositorio, compila
y registra un servicio systemd en el puerto 3000. Las instancias no aceptan
SSH; se entra por Session Manager.

**Despliegue.** Toda la infraestructura está descrita en Terraform en la
carpeta `infra/`. El primer despliegue se hace desde tu máquina. Después,
GitHub Actions asume un rol por OIDC, guarda el estado en S3 y aplica los
cambios en cada merge a `main`. El SHA del commit viaja al user-data, así
que cada versión nueva del código genera un launch template nuevo y el
Auto Scaling Group reemplaza las instancias una a una.

Los pasos concretos están en [infra/README.md](infra/README.md).

## Desarrollo local

```bash
pnpm install
pnpm run build
pnpm start
```

La app queda en `http://localhost:3000`. Sin metadatos de EC2 se identifica
como `local`. Para que el análisis funcione en local, el SDK toma las
credenciales del perfil de AWS CLI activo (`AWS_PROFILE`) y la región de
`AWS_REGION`.

## Estructura

| Ruta | Contenido |
|---|---|
| `src/server.ts` | Servidor Express: identidad IMDSv2, health check, análisis con Bedrock |
| `public/index.html` | Interfaz: identidad de la instancia, formulario y tarjeta de resultado |
| `infra/` | Terraform: red, balanceador, Auto Scaling, IAM, OIDC para GitHub |
| `.github/workflows/terraform.yml` | Plan en pull requests, apply en `main` |
| `docs/arquitectura.svg` | Diagrama de la arquitectura |
