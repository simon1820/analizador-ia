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

variable "github_repo" {
  description = "Repo de GitHub (owner/nombre) autorizado a asumir el rol del pipeline vía OIDC. Vacío = no crear el rol."
  type        = string
  default     = "simon1820/analizador-ia"
}
