# El balanceador recibe HTTP de cualquier origen.
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb"
  description = "Trafico web hacia el ALB"
  vpc_id      = aws_vpc.principal.id

  tags = { Name = "${var.project_name}-alb" }
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP desde internet"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "alb_salida" {
  security_group_id = aws_security_group.alb.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

# Las instancias sólo aceptan el 3000, y sólo desde el ALB.
# Sin SSH: el acceso es por Session Manager (rol con SSM).
resource "aws_security_group" "app" {
  name        = "${var.project_name}-app"
  description = "Instancias de la app"
  vpc_id      = aws_vpc.principal.id

  tags = { Name = "${var.project_name}-app" }
}

resource "aws_vpc_security_group_ingress_rule" "app_desde_alb" {
  security_group_id            = aws_security_group.app.id
  description                  = "Puerto de la app desde el ALB"
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = 3000
  to_port                      = 3000
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "app_salida" {
  security_group_id = aws_security_group.app.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}
