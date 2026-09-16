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
data "aws_iam_policy_document" "bedrock" {
  statement {
    actions = [
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

resource "aws_iam_instance_profile" "instancia" {
  name = "${var.project_name}-instancia"
  role = aws_iam_role.instancia.name
}
