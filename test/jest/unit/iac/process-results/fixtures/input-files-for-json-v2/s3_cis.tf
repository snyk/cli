resource "aws_s3_bucket" "writable" {
  bucket = "writable"
  acl = "public-read-write"
}

resource "aws_s3_bucket" "readable" {
  bucket = "readable"
  acl = "public-read"
}
