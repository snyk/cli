resource "aws_security_group" "allow_ssh" {
  name        = "allow_ssh"
  description = "Allow SSH inbound from anywhere"
  cidr_blocks = var.dummy
}

variable "dummy" {
  type = "string"
  default = "dummy_value"
}