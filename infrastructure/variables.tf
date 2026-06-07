variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "bedrock-chat"
}

variable "embedding_model_id" {
  description = "Bedrock embedding model ID"
  type        = string
  default     = "amazon.titan-embed-text-v2:0"
}

variable "vector_dimension" {
  description = "Dimension of the vectors produced by the embedding model"
  type        = number
  default     = 1024
}

variable "chat_model_id" {
  description = "Bedrock chat model ID for RetrieveAndGenerate"
  type        = string
  default     = "anthropic.claude-3-haiku-20240307-v1:0"
}

variable "s3_bucket_prefix" {
  description = "Prefix for the S3 data source bucket name"
  type        = string
  default     = "bedrock-chat-docs"
}

variable "s3_history_prefix" {
  description = "Prefix for the conversation history bucket name"
  type        = string
  default     = "bedrock-history"
}

variable "chunking_strategy" {
  description = "Chunking strategy (FIXED_SIZE recommended for S3 Vectors)"
  type        = string
  default     = "FIXED_SIZE"
  validation {
    condition     = contains(["DEFAULT", "FIXED_SIZE", "HIERARCHICAL", "SEMANTIC", "NONE"], var.chunking_strategy)
    error_message = "Chunking strategy must be one of: DEFAULT, FIXED_SIZE, HIERARCHICAL, SEMANTIC, NONE"
  }
}

variable "fixed_size_max_tokens" {
  description = "Maximum number of tokens per chunk for FIXED_SIZE chunking"
  type        = number
  default     = 1500
}

variable "fixed_size_overlap_percentage" {
  description = "Percentage of overlap between chunks for FIXED_SIZE chunking"
  type        = number
  default     = 10
}

# Cognito variables
variable "cognito_user_pool_name" {
  description = "Name for the Cognito User Pool"
  type        = string
  default     = "bedrock-chat-users"
}

variable "cognito_client_name" {
  description = "Name for the Cognito User Pool Client"
  type        = string
  default     = "bedrock-chat-client"
}

# Lambda variables
variable "lambda_runtime" {
  description = "Runtime for Lambda functions"
  type        = string
  default     = "python3.13"
}

variable "lambda_timeout" {
  description = "Timeout for Lambda functions in seconds"
  type        = number
  default     = 120
}

variable "lambda_memory_size" {
  description = "Memory size for Lambda functions in MB"
  type        = number
  default     = 512
}

# DynamoDB variables
variable "kbs_table_name" {
  description = "Name for the KBs DynamoDB table"
  type        = string
  default     = "bedrock-chat-kbs"
}

variable "agents_table_name" {
  description = "Name for the Agents DynamoDB table"
  type        = string
  default     = "bedrock-chat-agents"
}

variable "conversations_table_name" {
  description = "Name for the Conversations DynamoDB table"
  type        = string
  default     = "bedrock-chat-conversations"
}

# API Gateway variables
variable "rest_api_name" {
  description = "Name for the REST API"
  type        = string
  default     = "bedrock-chat-api"
}

# Frontend URL for Cognito callbacks
variable "frontend_url" {
  description = "Frontend application URL (for Cognito callback)"
  type        = string
  default     = "http://localhost:3000"
}
