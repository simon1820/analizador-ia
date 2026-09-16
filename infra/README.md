# Infraestructura

Todo lo que necesita la app en AWS, descrito en Terraform:

| Archivo | Qué crea |
|---|---|
| `network.tf` | VPC, dos subredes públicas, internet gateway, rutas |
| `security.tf` | Security groups del ALB (80 desde internet) y de la app (3000 sólo desde el ALB) |
| `iam.tf` | Rol de instancia con Session Manager y permiso para invocar Bedrock |
| `compute.tf` | Launch template (Amazon Linux 2023, IMDSv2, user-data) y Auto Scaling Group con instance refresh |
| `alb.tf` | Application Load Balancer, target group con health check en `/health`, listener 80 |
| `github_oidc.tf` | Rol que GitHub Actions asume vía OIDC para correr el pipeline |
| `user-data.sh.tftpl` | Script de arranque: instala Node, clona el repo, compila y registra el servicio systemd |

## Primer despliegue (desde tu máquina)

1. Crear el bucket para el estado remoto. Los nombres de bucket son globales, cambia el sufijo:

   ```bash
   aws s3api create-bucket --bucket tfstate-analizador-ia-TUSUFIJO --region us-east-1
   aws s3api put-bucket-versioning --bucket tfstate-analizador-ia-TUSUFIJO \
     --versioning-configuration Status=Enabled
   ```

2. Copiar `backend.hcl.example` a `backend.hcl` y poner el nombre del bucket.

3. Inicializar, revisar y aplicar:

   ```bash
   cd infra
   terraform init -backend-config=backend.hcl
   terraform plan
   terraform apply
   ```

4. Abrir la URL que imprime el output `url`. Las instancias tardan unos
   tres minutos en instalar Node y compilar; hasta entonces el ALB responde 503.

## Activar el pipeline

Después del primer apply:

1. Copiar el output `github_actions_role_arn`.
2. En GitHub, Settings > Secrets and variables > Actions, crear:
   - Secreto `AWS_ROLE_ARN` con ese ARN.
   - Secreto `TF_STATE_BUCKET` con el nombre del bucket.
   - Variable `AWS_REGION` (opcional, por defecto `us-east-1`).

Desde ahí, cada pull request comenta el `terraform plan` y cada merge a
`main` hace `terraform apply` pasando el SHA del commit como versión.
Eso cambia el user-data, el launch template genera una versión nueva y el
Auto Scaling Group reemplaza las instancias una a una.

## Comandos útiles

```bash
# Ver estado del instance refresh en curso
aws autoscaling describe-instance-refreshes --auto-scaling-group-name analizador-ia-asg

# Entrar a una instancia sin SSH
aws ssm start-session --target i-XXXXXXXX

# Ver el log del arranque dentro de la instancia
sudo cat /var/log/cloud-init-output.log

# Destruir todo cuando termines de practicar
terraform destroy
```

## Si ya tenías recursos creados a mano

Este módulo crea todo desde cero en una VPC nueva, así que no choca con lo
que hayas hecho en consola. Cuando confirmes que funciona, borra lo manual
para no pagar dos veces.
