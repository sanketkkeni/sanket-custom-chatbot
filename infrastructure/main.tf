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
  chat_model_arn      = "arn:aws:bedrock:${var.aws_region}::foundation-model/${var.chat_model_id}"
}
