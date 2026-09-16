data "aws_availability_zones" "disponibles" {
  state = "available"
}

resource "aws_vpc" "principal" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${var.project_name}-vpc" }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.principal.id

  tags = { Name = "${var.project_name}-igw" }
}

# Dos subredes públicas en zonas distintas: el ALB exige al menos dos.
# Las instancias reciben IP pública porque no hay NAT gateway y
# necesitan salida a internet para instalar Node y clonar el repo.
resource "aws_subnet" "publica" {
  count = 2

  vpc_id                  = aws_vpc.principal.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = data.aws_availability_zones.disponibles.names[count.index]
  map_public_ip_on_launch = true

  tags = { Name = "${var.project_name}-publica-${count.index + 1}" }
}

resource "aws_route_table" "publica" {
  vpc_id = aws_vpc.principal.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = { Name = "${var.project_name}-rt-publica" }
}

resource "aws_route_table_association" "publica" {
  count = 2

  subnet_id      = aws_subnet.publica[count.index].id
  route_table_id = aws_route_table.publica.id
}
