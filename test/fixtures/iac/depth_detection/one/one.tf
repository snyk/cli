resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
}

resource "aws_subnet" "private2" {
  vpc_id = aws_vpc.main.id
  cidr_block = "10.0.4.0/24"
  availability_zone = "ap-northeast-1c"

  tags = {
    Name = "terraform-example/private2"
  }
}

resource "aws_internet_gateway" "terraform_example" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "terraform-example/igw"
  }
}
