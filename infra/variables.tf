variable "project_name" {
  description = "Prefijo para nombrar todos los recursos."
  type        = string
  default     = "analizador-ia"
}

variable "aws_region" {
  description = "Región donde se despliega todo."
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "instance_type" {
  description = "Tipo de instancia EC2 de la app."
  type        = string
  default     = "t3.micro"
}

variable "desired_capacity" {
  description = "Instancias que mantiene el Auto Scaling Group."
  type        = number
  default     = 2
}

variable "repo_url" {
  description = "Repositorio que clona cada instancia al arrancar."
  type        = string
  default     = "https://github.com/simon1820/analizador-ia.git"
}

variable "git_ref" {
  description = "Rama, tag o commit que despliega la instancia."
  type        = string
  default     = "main"
}

variable "app_version" {
  description = "Identificador del despliegue (normalmente el SHA del commit). Cambiarlo fuerza un instance refresh."
  type        = string
  default     = "manual"
}

variable "ia_proveedor" {
  description = "Proveedor de IA de la app: 'bedrock' (Claude en Bedrock, con el rol de la instancia) o 'anthropic' (API de Anthropic, clave en Parameter Store)."
  type        = string
  default     = "anthropic"
  validation {
    condition     = contains(["bedrock", "anthropic"], var.ia_proveedor)
    error_message = "ia_proveedor debe ser 'bedrock' o 'anthropic'."
  }
}

variable "ia_modelo" {
  description = "Modelo a usar. Vacío = el predeterminado del proveedor (claude-sonnet-5 en Anthropic, anthropic.claude-sonnet-5 en Bedrock)."
  type        = string
  default     = "claude-sonnet-5"
}

variable "anthropic_workspace_id" {
  description = "Sólo si la clave de Anthropic no está ligada a un workspace: ID del workspace (wrkspc_...). Vacío si la clave ya es de un workspace."
  type        = string
  default     = ""
}

variable "anthropic_api_key_param" {
  description = "Nombre del parámetro SecureString en SSM con la clave de la API de Anthropic. Se crea a mano, nunca con Terraform."
  type        = string
  default     = "/analizador-ia/anthropic-api-key"
}

variable "github_repo" {
  description = "Repo de GitHub (owner/nombre) autorizado a asumir el rol del pipeline vía OIDC. Vacío = no crear el rol."
  type        = string
  default     = "simon1820/analizador-ia"
}

# GitHub incluye los IDs numéricos en el claim `sub` del token OIDC:
#   repo:<owner>@<owner_id>/<repo>@<repo_id>:ref:refs/heads/main
# Se obtienen en https://api.github.com/repos/<owner>/<repo> (campos id y owner.id).
variable "github_owner_id" {
  description = "ID numérico del dueño del repo en GitHub."
  type        = string
  default     = "124012675"
}

variable "github_repo_id" {
  description = "ID numérico del repo en GitHub."
  type        = string
  default     = "1337375033"
}
