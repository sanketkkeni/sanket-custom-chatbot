resource "aws_api_gateway_account" "main" {
  cloudwatch_role_arn = aws_iam_role.apigateway_logging.arn
}

# REST API
resource "aws_apigatewayv2_api" "rest_api" {
  name          = var.rest_api_name
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization", "X-Requested-With"]
    expose_headers = []
    max_age = 3600
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# REST API Stage
resource "aws_apigatewayv2_stage" "rest_stage" {
  api_id      = aws_apigatewayv2_api.rest_api.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 1000
    throttling_rate_limit  = 500
  }

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.rest_access_logs.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      resourcePath   = "$context.resourcePath"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
      integrationErrorMessage = "$context.integrationErrorMessage"
    })
  }

  depends_on = [aws_api_gateway_account.main]

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# KB API Integration
resource "aws_apigatewayv2_integration" "kb_api_integration" {
  api_id              = aws_apigatewayv2_api.rest_api.id
  integration_type    = "AWS_PROXY"
  integration_uri     = aws_lambda_function.kb_api.arn
  payload_format_version = "2.0"
}

# Chat Handler Integration
resource "aws_apigatewayv2_integration" "chat_integration" {
  api_id              = aws_apigatewayv2_api.rest_api.id
  integration_type    = "AWS_PROXY"
  integration_uri     = aws_lambda_function.chat_handler.arn
  payload_format_version = "2.0"
}

# History Handler Integration
resource "aws_apigatewayv2_integration" "history_integration" {
  api_id              = aws_apigatewayv2_api.rest_api.id
  integration_type    = "AWS_PROXY"
  integration_uri     = aws_lambda_function.history_handler.arn
  payload_format_version = "2.0"
}

# KB API Routes
resource "aws_apigatewayv2_route" "kbs_list" {
  api_id    = aws_apigatewayv2_api.rest_api.id
  route_key = "GET /kbs"
  target    = "integrations/${aws_apigatewayv2_integration.kb_api_integration.id}"
}

resource "aws_apigatewayv2_route" "kbs_create" {
  api_id    = aws_apigatewayv2_api.rest_api.id
  route_key = "POST /kbs"
  target    = "integrations/${aws_apigatewayv2_integration.kb_api_integration.id}"
}

resource "aws_apigatewayv2_route" "kbs_get" {
  api_id    = aws_apigatewayv2_api.rest_api.id
  route_key = "GET /kbs/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.kb_api_integration.id}"
}

resource "aws_apigatewayv2_route" "kbs_delete" {
  api_id    = aws_apigatewayv2_api.rest_api.id
  route_key = "DELETE /kbs/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.kb_api_integration.id}"
}

resource "aws_apigatewayv2_route" "kbs_upload" {
  api_id    = aws_apigatewayv2_api.rest_api.id
  route_key = "POST /kbs/{id}/upload"
  target    = "integrations/${aws_apigatewayv2_integration.kb_api_integration.id}"
}

resource "aws_apigatewayv2_route" "kbs_files_list" {
  api_id    = aws_apigatewayv2_api.rest_api.id
  route_key = "GET /kbs/{id}/files"
  target    = "integrations/${aws_apigatewayv2_integration.kb_api_integration.id}"
}

resource "aws_apigatewayv2_route" "kbs_file_delete" {
  api_id    = aws_apigatewayv2_api.rest_api.id
  route_key = "DELETE /kbs/{id}/files/{file}"
  target    = "integrations/${aws_apigatewayv2_integration.kb_api_integration.id}"
}

resource "aws_apigatewayv2_route" "kbs_sync_start" {
  api_id    = aws_apigatewayv2_api.rest_api.id
  route_key = "POST /kbs/{id}/sync"
  target    = "integrations/${aws_apigatewayv2_integration.kb_api_integration.id}"
}

resource "aws_apigatewayv2_route" "kbs_sync_status" {
  api_id    = aws_apigatewayv2_api.rest_api.id
  route_key = "GET /kbs/{id}/sync"
  target    = "integrations/${aws_apigatewayv2_integration.kb_api_integration.id}"
}

resource "aws_apigatewayv2_route" "kbs_stats" {
  api_id    = aws_apigatewayv2_api.rest_api.id
  route_key = "GET /kbs/{id}/stats"
  target    = "integrations/${aws_apigatewayv2_integration.kb_api_integration.id}"
}

# Chat Routes
resource "aws_apigatewayv2_route" "chat" {
  api_id    = aws_apigatewayv2_api.rest_api.id
  route_key = "POST /chat"
  target    = "integrations/${aws_apigatewayv2_integration.chat_integration.id}"
}

# History Routes
resource "aws_apigatewayv2_route" "history_list" {
  api_id    = aws_apigatewayv2_api.rest_api.id
  route_key = "GET /history"
  target    = "integrations/${aws_apigatewayv2_integration.history_integration.id}"
}

resource "aws_apigatewayv2_route" "history_get" {
  api_id    = aws_apigatewayv2_api.rest_api.id
  route_key = "GET /history/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.history_integration.id}"
}

resource "aws_apigatewayv2_route" "history_delete" {
  api_id    = aws_apigatewayv2_api.rest_api.id
  route_key = "DELETE /history/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.history_integration.id}"
}

# CORS Preflight Routes
resource "aws_apigatewayv2_route" "cors_preflight_root" {
  api_id    = aws_apigatewayv2_api.rest_api.id
  route_key = "OPTIONS /{proxy}"
  target    = "integrations/${aws_apigatewayv2_integration.kb_api_integration.id}"
}

# Lambda Permissions for KB API
resource "aws_lambda_permission" "kb_api_invoke" {
  statement_id  = "AllowAPIGatewayKBAPI"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.kb_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.rest_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "chat_invoke" {
  statement_id  = "AllowAPIGatewayChat"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.chat_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.rest_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "history_invoke" {
  statement_id  = "AllowAPIGatewayHistory"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.history_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.rest_api.execution_arn}/*/*"
}
