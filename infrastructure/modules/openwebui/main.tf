# Lambda Function: OpenAI Proxy
resource "aws_lambda_function" "openai_proxy" {
  function_name = "${var.project_name}-openai-proxy"
  runtime       = var.lambda_runtime
  handler       = "openai_proxy.lambda_handler"
  role          = var.lambda_role_arn
  timeout       = var.lambda_timeout
  memory_size   = var.lambda_memory_size

  filename         = "${path.module}/openai_proxy.zip"
  source_code_hash = filebase64sha256("${path.module}/openai_proxy.zip")

  environment {
    variables = {
      KB_TABLE_NAME  = var.kbs_table_name
      CHAT_MODEL_ARN = var.chat_model_arn
      OPENAI_API_KEY = var.openai_api_key
      LOG_LEVEL      = "INFO"
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# API Gateway Integration
resource "aws_apigatewayv2_integration" "openai_proxy" {
  api_id                 = var.api_gateway_id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.openai_proxy.arn
  payload_format_version = "2.0"
}

# Routes
resource "aws_apigatewayv2_route" "openai_models" {
  api_id    = var.api_gateway_id
  route_key = "GET /v1/models"
  target    = "integrations/${aws_apigatewayv2_integration.openai_proxy.id}"
}

resource "aws_apigatewayv2_route" "openai_chat" {
  api_id    = var.api_gateway_id
  route_key = "POST /v1/chat/completions"
  target    = "integrations/${aws_apigatewayv2_integration.openai_proxy.id}"
}

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "openai_proxy" {
  statement_id  = "AllowAPIGatewayOpenAIProxy"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.openai_proxy.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}
