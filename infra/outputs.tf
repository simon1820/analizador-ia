output "url" {
  description = "Dirección pública de la app."
  value       = "http://${aws_lb.app.dns_name}"
}

output "asg_name" {
  value = aws_autoscaling_group.app.name
}

output "github_actions_role_arn" {
  description = "Ponerlo como secreto AWS_ROLE_ARN en el repo de GitHub."
  value       = local.crear_oidc ? aws_iam_role.github_actions[0].arn : null
}
