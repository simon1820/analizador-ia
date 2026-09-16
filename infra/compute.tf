# AMI más reciente de Amazon Linux 2023, resuelta vía SSM.
data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

resource "aws_launch_template" "app" {
  name_prefix   = "${var.project_name}-"
  image_id      = data.aws_ssm_parameter.al2023.value
  instance_type = var.instance_type

  update_default_version = true

  iam_instance_profile {
    arn = aws_iam_instance_profile.instancia.arn
  }

  vpc_security_group_ids = [aws_security_group.app.id]

  # IMDSv2 obligatorio: la app ya lo usa y evita el SSRF clásico.
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  user_data = base64encode(templatefile("${path.module}/user-data.sh.tftpl", {
    repo_url      = var.repo_url
    git_ref       = var.git_ref
    app_version   = var.app_version
    aws_region    = var.aws_region
    ia_proveedor  = var.ia_proveedor
    ia_modelo     = var.ia_modelo
    api_key_param = var.anthropic_api_key_param
    workspace_id  = var.anthropic_workspace_id
  }))

  tag_specifications {
    resource_type = "instance"
    tags          = { Name = "${var.project_name}-app" }
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_autoscaling_group" "app" {
  name                      = "${var.project_name}-asg"
  vpc_zone_identifier       = aws_subnet.publica[*].id
  min_size                  = 1
  max_size                  = var.desired_capacity + 1
  desired_capacity          = var.desired_capacity
  health_check_type         = "ELB"
  health_check_grace_period = 180

  target_group_arns = [aws_lb_target_group.app.arn]

  launch_template {
    id      = aws_launch_template.app.id
    version = aws_launch_template.app.latest_version
  }

  # Cada versión nueva del launch template (cambio de user-data, AMI o
  # tipo) reemplaza las instancias de forma gradual sin bajar el servicio.
  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 50
      instance_warmup        = 120
    }
  }

  tag {
    key                 = "Name"
    value               = "${var.project_name}-app"
    propagate_at_launch = true
  }

  lifecycle {
    ignore_changes = [desired_capacity]
  }
}
