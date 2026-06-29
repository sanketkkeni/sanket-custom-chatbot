terraform {
  required_version = "~> 1.15.2"

  cloud {
    organization = "sanket-poc"

    workspaces {
      name = "sanket_custom_chatbot"
    }
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.27.0, < 7.0.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

locals {
  embedding_model_arn = "arn:aws:bedrock:${var.aws_region}::foundation-model/${var.embedding_model_id}"
  chat_model_arn      = "arn:aws:bedrock:${var.aws_region}:${data.aws_caller_identity.current.account_id}:inference-profile/${var.chat_model_id}"
  parsing_model_arn   = "arn:aws:bedrock:${var.aws_region}:${data.aws_caller_identity.current.account_id}:inference-profile/${var.parsing_model_id}"
}

resource "random_password" "openai_api_key" {
  length  = 32
  special = false
}

resource "random_password" "webui_secret_key" {
  length  = 64
  special = false
}

module "openwebui_ec2" {
  source = "./modules/openwebui-ec2"

  project_name         = var.project_name
  environment          = var.environment
  cognito_user_pool_id = aws_cognito_user_pool.this.id
  suffix               = random_string.suffix.result
  openai_api_key       = var.openai_api_key != "" ? var.openai_api_key : random_password.openai_api_key.result
  api_gateway_endpoint = aws_apigatewayv2_api.rest_api.api_endpoint
  webui_secret_key     = random_password.webui_secret_key.result
}

module "openwebui" {
  source = "./modules/openwebui"

  project_name              = var.project_name
  environment               = var.environment
  lambda_role_arn           = aws_iam_role.lambda_role.arn
  lambda_role_name          = aws_iam_role.lambda_role.name
  lambda_runtime            = var.lambda_runtime
  lambda_timeout            = 300
  lambda_memory_size        = var.lambda_memory_size
  api_gateway_id            = aws_apigatewayv2_api.rest_api.id
  api_gateway_execution_arn = aws_apigatewayv2_api.rest_api.execution_arn
  kbs_table_name            = aws_dynamodb_table.kbs.name
  chat_model_arn            = local.chat_model_arn
  openai_api_key            = var.openai_api_key != "" ? var.openai_api_key : random_password.openai_api_key.result
}
