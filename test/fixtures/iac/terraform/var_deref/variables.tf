variable "remote_user_addr" {
  type = list(string)
  default = ["0.0.0.0/0", "1.2.3.4/32"]
}

variable "remote_user_addr_terraform_tfvars" {
  type = list(string)
  default = ["1.2.3.4/32"]
}

variable "remote_user_addr_a_auto_tfvars" {
  type = list(string)
  default = ["1.2.3.4/32"]
}

variable "remote_user_addr_b_auto_tfvars" {
  type = list(string)
  default = ["1.2.3.4/32"]
}