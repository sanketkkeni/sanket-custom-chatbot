output "openai_proxy_function_name" {
  description = "The name of the OpenAI proxy Lambda function"
  value       = aws_lambda_function.openai_proxy.function_name
}

output "openai_compatible_endpoint" {
  description = "Base URL for the OpenAI-compatible endpoint (append /v1 for API calls)"
  value       = var.api_gateway_execution_arn
}
