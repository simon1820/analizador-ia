data "aws_iam_policy_document" "ec2_asume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "instancia" {
  name               = "${var.project_name}-instancia"
  assume_role_policy = data.aws_iam_policy_document.ec2_asume.json
}

# Session Manager: consola en la instancia sin abrir SSH.
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.instancia.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Fase 2: la app llama a Bedrock con las credenciales del rol,
# sin claves en el código ni en variables de entorno.
# El endpoint nuevo de Bedrock (Messages API, "bedrock-mantle") usa su
# propia acción IAM; las de InvokeModel se dejan por compatibilidad.
data "aws_iam_policy_document" "bedrock" {
  statement {
    actions = [
      "bedrock-mantle:CreateInference",
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "bedrock" {
  name   = "bedrock-invoke"
  role   = aws_iam_role.instancia.id
  policy = data.aws_iam_policy_document.bedrock.json
}

# Proveedor "anthropic": la app lee la clave de la API desde un parámetro
# SecureString creado a mano. Sólo ese parámetro, y sólo descifrado vía SSM.
data "aws_caller_identity" "actual" {}

data "aws_iam_policy_document" "clave_api" {
  statement {
    actions   = ["ssm:GetParameter"]
    resources = ["arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.actual.account_id}:parameter${var.anthropic_api_key_param}"]
  }
  statement {
    actions   = ["kms:Decrypt"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ssm.${var.aws_region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "clave_api" {
  name   = "leer-clave-anthropic"
  role   = aws_iam_role.instancia.id
  policy = data.aws_iam_policy_document.clave_api.json
}

resource "aws_iam_instance_profile" "instancia" {
  name = "${var.project_name}-instancia"
  role = aws_iam_role.instancia.name
}
