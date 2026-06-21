# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "rest_access_logs" {
  name              = "/aws/apigateway/${var.project_name}/rest"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_cloudwatch_log_group" "kb_api_logs" {
  name              = "/aws/lambda/${var.project_name}-kb-api"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_cloudwatch_log_group" "chat_handler_logs" {
  name              = "/aws/lambda/${var.project_name}-chat-handler"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_cloudwatch_log_group" "history_handler_logs" {
  name              = "/aws/lambda/${var.project_name}-history-handler"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}


