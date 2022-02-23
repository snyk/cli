resource "aws_security_group" "allow_ssh" {
  name        = "allow_ssh"
  description = "Allow SSH inbound from anywhere"
  vpc_id      = "${aws_vpc.main.id}"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.remote_user_addr
  }
}

resource "aws_security_group" "allow_ssh_terraform_tfvars" {
  name        = "allow_ssh"
  description = "Allow SSH inbound from anywhere"
  vpc_id      = "${aws_vpc.main.id}"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.remote_user_addr_terraform_tfvars
  }
}

resource "aws_security_group" "allow_ssh_a_auto_tfvars" {
  name        = "allow_ssh"
  description = "Allow SSH inbound from anywhere"
  vpc_id      = "${aws_vpc.main.id}"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.remote_user_addr_a_auto_tfvars
  }
}

resource "aws_security_group" "allow_ssh_b_auto_tfvars" {
  name        = "allow_ssh"
  description = "Allow SSH inbound from anywhere"
  vpc_id      = "${aws_vpc.main.id}"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.remote_user_addr_b_auto_tfvars
  }
}