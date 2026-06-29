variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "cognito_user_pool_id" {
  description = "ID of the Cognito User Pool"
  type        = string
}

variable "suffix" {
  description = "Random suffix for unique naming"
  type        = string
}

variable "openai_api_key" {
  description = "Shared API key for OpenAI-compatible proxy auth"
  type        = string
  sensitive   = true
}

variable "api_gateway_endpoint" {
  description = "API Gateway endpoint URL"
  type        = string
}

variable "webui_secret_key" {
  description = "Secret key for Open Web UI session encryption"
  type        = string
  sensitive   = true
}
