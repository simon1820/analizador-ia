# Permite que GitHub Actions asuma un rol sin guardar claves de AWS
# como secretos. Sólo el repo indicado, en main o en pull requests.
locals {
  crear_oidc = var.github_repo != ""

  # Formato actual del claim `sub` (con IDs) y el formato antiguo (sin IDs),
  # para que el rol funcione con cualquiera de los dos.
  github_owner = split("/", var.github_repo)[0]
  github_name  = try(split("/", var.github_repo)[1], "")
  github_subs = [
    "repo:${local.github_owner}@${var.github_owner_id}/${local.github_name}@${var.github_repo_id}:ref:refs/heads/main",
    "repo:${local.github_owner}@${var.github_owner_id}/${local.github_name}@${var.github_repo_id}:pull_request",
    "repo:${var.github_repo}:ref:refs/heads/main",
    "repo:${var.github_repo}:pull_request",
  ]
}

resource "aws_iam_openid_connect_provider" "github" {
  count = local.crear_oidc ? 1 : 0

  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  # AWS valida el certificado de GitHub por su cuenta; el thumbprint es
  # obligatorio en la API pero ya no se usa para verificar.
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_policy_document" "github_asume" {
  count = local.crear_oidc ? 1 : 0

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github[0].arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = local.github_subs
    }
  }
}

resource "aws_iam_role" "github_actions" {
  count = local.crear_oidc ? 1 : 0

  name               = "${var.project_name}-github-actions"
  assume_role_policy = data.aws_iam_policy_document.github_asume[0].json
}

# Para practicar es suficiente. En un entorno real se acota a los
# servicios que toca este módulo (ec2, elbv2, autoscaling, iam, s3, ssm).
resource "aws_iam_role_policy_attachment" "github_admin" {
  count = local.crear_oidc ? 1 : 0

  role       = aws_iam_role.github_actions[0].name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}
