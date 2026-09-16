terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # Estado remoto en S3. Los valores concretos van en backend.hcl
  # (ignorado por git); ver backend.hcl.example y el README.
  backend "s3" {}
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Proyecto = var.project_name
      Gestion  = "terraform"
    }
  }
}
