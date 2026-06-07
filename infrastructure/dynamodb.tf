# DynamoDB Table for KBs
resource "aws_dynamodb_table" "kbs" {
  name           = var.kbs_table_name
  billing_mode   = "PAY_PER_REQUEST"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "kbId"
    type = "S"
  }

  attribute {
    name = "bedrockKbId"
    type = "S"
  }

  hash_key  = "userId"
  range_key = "kbId"

  global_secondary_index {
    name            = "bedrockKbId-index"
    hash_key        = "bedrockKbId"
    projection_type = "ALL"
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_dynamodb_table" "agents" {
  name           = var.agents_table_name
  billing_mode   = "PAY_PER_REQUEST"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "agentId"
    type = "S"
  }

  attribute {
    name = "kbId"
    type = "S"
  }

  hash_key  = "userId"
  range_key = "agentId"

  global_secondary_index {
    name            = "kbId-index"
    hash_key        = "kbId"
    projection_type = "ALL"
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_dynamodb_table" "conversations" {
  name           = var.conversations_table_name
  billing_mode   = "PAY_PER_REQUEST"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "conversationId"
    type = "S"
  }

  attribute {
    name = "agentId"
    type = "S"
  }

  attribute {
    name = "kbId"
    type = "S"
  }

  hash_key  = "userId"
  range_key = "conversationId"

  global_secondary_index {
    name            = "agentId-index"
    hash_key        = "agentId"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "kbId-index"
    hash_key        = "kbId"
    projection_type = "ALL"
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}
