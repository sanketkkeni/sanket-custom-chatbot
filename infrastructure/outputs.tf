# Cognito Outputs
output "user_pool_id" {
  description = "The ID of the Cognito User Pool"
  value       = aws_cognito_user_pool.this.id
}

output "user_pool_arn" {
  description = "The ARN of the Cognito User Pool"
  value       = aws_cognito_user_pool.this.arn
}

output "user_pool_client_id" {
  description = "The ID of the Cognito User Pool Client"
  value       = aws_cognito_user_pool_client.this.id
}

# DynamoDB Outputs
output "kbs_table_name" {
  description = "The name of the KBs DynamoDB table"
  value       = aws_dynamodb_table.kbs.name
}

output "agents_table_name" {
  description = "The name of the Agents DynamoDB table"
  value       = aws_dynamodb_table.agents.name
}

output "conversations_table_name" {
  description = "The name of the Conversations DynamoDB table"
  value       = aws_dynamodb_table.conversations.name
}

# S3 Outputs
output "documents_bucket" {
  description = "The name of the S3 bucket for user documents"
  value       = aws_s3_bucket.documents.bucket
}

output "history_bucket" {
  description = "The name of the S3 bucket for conversation history"
  value       = aws_s3_bucket.history.bucket
}

output "multimodal_storage_bucket" {
  description = "The S3 bucket for multimodal KB storage (JPG/PNG parsing)"
  value       = aws_s3_bucket.multimodal_storage.bucket
}

output "vector_bucket_name" {
  description = "The name of the S3 Vector bucket"
  value       = aws_s3vectors_vector_bucket.this.vector_bucket_name
}

# API Gateway Outputs
output "rest_api_id" {
  description = "The ID of the REST API Gateway"
  value       = aws_apigatewayv2_api.rest_api.id
}

output "rest_api_endpoint" {
  description = "The REST API endpoint URL"
  value       = aws_apigatewayv2_api.rest_api.api_endpoint
}

# Lambda Outputs
output "kb_api_function_name" {
  description = "The name of the KB API Lambda function"
  value       = aws_lambda_function.kb_api.function_name
}

output "chat_handler_function_name" {
  description = "The name of the Chat Handler Lambda function"
  value       = aws_lambda_function.chat_handler.function_name
}

output "history_handler_function_name" {
  description = "The name of the History Handler Lambda function"
  value       = aws_lambda_function.history_handler.function_name
}

output "image_processor_function_name" {
  description = "The name of the Image Processor Lambda function"
  value       = aws_lambda_function.image_processor.function_name
}

# IAM Role Outputs
output "lambda_role_arn" {
  description = "The ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_role.arn
}

output "bedrock_role_arn" {
  description = "The ARN of the Bedrock execution role"
  value       = aws_iam_role.bedrock_execution.arn
}

# Frontend Configuration
output "frontend_config" {
  description = "Configuration values needed for frontend setup"
  value = {
    user_pool_id        = aws_cognito_user_pool.this.id
    user_pool_client_id = aws_cognito_user_pool_client.this.id
    rest_api_endpoint   = aws_apigatewayv2_api.rest_api.api_endpoint
  }
}
