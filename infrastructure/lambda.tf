# Lambda Function: KB API Handler
resource "aws_lambda_function" "kb_api" {
  function_name = "${var.project_name}-kb-api"
  runtime       = var.lambda_runtime
  handler       = "kb_api.lambda_handler"
  role          = aws_iam_role.lambda_role.arn
  timeout       = var.lambda_timeout
  memory_size   = var.lambda_memory_size

  filename = "${path.module}/kb_api.zip"

  environment {
    variables = {
      KB_TABLE_NAME          = aws_dynamodb_table.kbs.name
      AGENTS_TABLE_NAME      = aws_dynamodb_table.agents.name
      CONVERSATIONS_TABLE_NAME = aws_dynamodb_table.conversations.name
      DOCUMENTS_BUCKET       = aws_s3_bucket.documents.bucket
      VECTOR_BUCKET_NAME     = aws_s3vectors_vector_bucket.this.vector_bucket_name
      BEDROCK_ROLE_ARN       = aws_iam_role.bedrock_execution.arn
      EMBEDDING_MODEL_ARN    = local.embedding_model_arn
      CHAT_MODEL_ARN         = local.chat_model_arn
      VECTOR_DIMENSION       = tostring(var.vector_dimension)
      CHUNKING_STRATEGY      = var.chunking_strategy
      FIXED_SIZE_MAX_TOKENS  = tostring(var.fixed_size_max_tokens)
      FIXED_SIZE_OVERLAP_PCT = tostring(var.fixed_size_overlap_percentage)
      LOG_LEVEL              = "INFO"
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# Lambda Function: Chat Handler
resource "aws_lambda_function" "chat_handler" {
  function_name = "${var.project_name}-chat-handler"
  runtime       = var.lambda_runtime
  handler       = "chat_handler.lambda_handler"
  role          = aws_iam_role.lambda_role.arn
  timeout       = var.lambda_timeout
  memory_size   = var.lambda_memory_size

  filename = "${path.module}/chat_handler.zip"

  environment {
    variables = {
      KB_TABLE_NAME          = aws_dynamodb_table.kbs.name
      AGENTS_TABLE_NAME      = aws_dynamodb_table.agents.name
      CONVERSATIONS_TABLE_NAME = aws_dynamodb_table.conversations.name
      HISTORY_BUCKET         = aws_s3_bucket.history.bucket
      CHAT_MODEL_ARN         = local.chat_model_arn
      LOG_LEVEL              = "INFO"
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# Lambda Function: History Handler
resource "aws_lambda_function" "history_handler" {
  function_name = "${var.project_name}-history-handler"
  runtime       = var.lambda_runtime
  handler       = "history_handler.lambda_handler"
  role          = aws_iam_role.lambda_role.arn
  timeout       = var.lambda_timeout
  memory_size   = var.lambda_memory_size

  filename = "${path.module}/history_handler.zip"

  environment {
    variables = {
      CONVERSATIONS_TABLE_NAME = aws_dynamodb_table.conversations.name
      HISTORY_BUCKET          = aws_s3_bucket.history.bucket
      LOG_LEVEL               = "INFO"
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}
