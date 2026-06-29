variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "lambda_role_arn" {
  description = "ARN of the shared Lambda execution role"
  type        = string
}

variable "lambda_role_name" {
  description = "Name of the shared Lambda execution role (for policy attachment)"
  type        = string
}

variable "lambda_runtime" {
  description = "Runtime for Lambda function"
  type        = string
  default     = "python3.13"
}

variable "lambda_timeout" {
  description = "Timeout for Lambda function in seconds"
  type        = number
  default     = 120
}

variable "lambda_memory_size" {
  description = "Memory size for Lambda function in MB"
  type        = number
  default     = 512
}

variable "api_gateway_id" {
  description = "ID of the existing HTTP API Gateway"
  type        = string
}

variable "api_gateway_execution_arn" {
  description = "Execution ARN of the existing HTTP API Gateway"
  type        = string
}

variable "kbs_table_name" {
  description = "Name of the KBs DynamoDB table"
  type        = string
}

variable "chat_model_arn" {
  description = "ARN of the Bedrock chat model inference profile"
  type        = string
}

variable "openai_api_key" {
  description = "Shared API key for OpenAI-compatible proxy auth"
  type        = string
  sensitive   = true
}
