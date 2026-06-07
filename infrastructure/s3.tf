resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

# Document bucket for user file uploads
resource "aws_s3_bucket" "documents" {
  bucket        = "${var.s3_bucket_prefix}-${random_string.suffix.result}"
  force_destroy = true

  tags = {
    Name        = "${var.s3_bucket_prefix}-${random_string.suffix.result}"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# History bucket for conversation MD files
resource "aws_s3_bucket" "history" {
  bucket        = "${var.s3_history_prefix}-${random_string.suffix.result}"
  force_destroy = true

  tags = {
    Name        = "${var.s3_history_prefix}-${random_string.suffix.result}"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_s3_bucket_versioning" "history" {
  bucket = aws_s3_bucket.history.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "history" {
  bucket = aws_s3_bucket.history.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# S3 Vector bucket for embeddings
resource "aws_s3vectors_vector_bucket" "this" {
  vector_bucket_name = "${var.project_name}-vectors"
}
