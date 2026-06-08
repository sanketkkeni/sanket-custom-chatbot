data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

# IAM Role for Lambda Functions
resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda DynamoDB access
resource "aws_iam_policy" "lambda_dynamodb" {
  name = "${var.project_name}-lambda-dynamodb"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ]
      Resource = [
        aws_dynamodb_table.kbs.arn,
        "${aws_dynamodb_table.kbs.arn}/index/*",
        aws_dynamodb_table.agents.arn,
        "${aws_dynamodb_table.agents.arn}/index/*",
        aws_dynamodb_table.conversations.arn,
        "${aws_dynamodb_table.conversations.arn}/index/*"
      ]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_dynamodb" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_dynamodb.arn
}

# Lambda S3 access (documents bucket)
resource "aws_iam_policy" "lambda_s3_documents" {
  name = "${var.project_name}-lambda-s3-documents"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.documents.arn,
          "${aws_s3_bucket.documents.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_s3_documents" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_s3_documents.arn
}

# Lambda S3 access (history bucket)
resource "aws_iam_policy" "lambda_s3_history" {
  name = "${var.project_name}-lambda-s3-history"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.history.arn,
          "${aws_s3_bucket.history.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_s3_history" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_s3_history.arn
}

# Lambda Cognito read access
resource "aws_iam_policy" "lambda_cognito" {
  name = "${var.project_name}-lambda-cognito"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "cognito-idp:ListUsers",
        "cognito-idp:AdminGetUser"
      ]
      Resource = aws_cognito_user_pool.this.arn
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_cognito" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_cognito.arn
}

# Lambda Bedrock access
resource "aws_iam_policy" "lambda_bedrock" {
  name = "${var.project_name}-lambda-bedrock"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:CreateKnowledgeBase",
          "bedrock:GetKnowledgeBase",
          "bedrock:ListKnowledgeBases",
          "bedrock:DeleteKnowledgeBase",
          "bedrock:CreateDataSource",
          "bedrock:GetDataSource",
          "bedrock:ListDataSources",
          "bedrock:DeleteDataSource",
          "bedrock:StartIngestionJob",
          "bedrock:GetIngestionJob",
          "bedrock:ListIngestionJobs",
          "bedrock:Retrieve",
          "bedrock:RetrieveAndGenerate",
          "bedrock:GetInferenceProfile"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel"
        ]
        Resource = [
          local.embedding_model_arn,
          local.chat_model_arn,
          "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
          "arn:aws:bedrock:us-east-2::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
          "arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "aws-marketplace:Subscribe",
          "aws-marketplace:ViewSubscriptions"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_bedrock" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_bedrock.arn
}

# Lambda S3 Vectors access
resource "aws_iam_policy" "lambda_s3_vectors" {
  name = "${var.project_name}-lambda-s3-vectors"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3vectors:CreateIndex",
          "s3vectors:DeleteIndex",
          "s3vectors:GetIndex",
          "s3vectors:ListIndexes"
        ]
        Resource = [
          aws_s3vectors_vector_bucket.this.vector_bucket_arn,
          "${aws_s3vectors_vector_bucket.this.vector_bucket_arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_s3_vectors" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_s3_vectors.arn
}

# Lambda IAM PassRole for Bedrock execution role
resource "aws_iam_policy" "lambda_pass_role" {
  name = "${var.project_name}-lambda-pass-role"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = "iam:PassRole"
      Resource = aws_iam_role.bedrock_execution.arn
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_pass_role" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_pass_role.arn
}

# IAM Role for API Gateway logging
resource "aws_iam_role" "apigateway_logging" {
  name = "${var.project_name}-apigateway-logging"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "apigateway.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_policy" "apigateway_logging" {
  name = "${var.project_name}-apigateway-logging"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
        "logs:PutLogEvents",
        "logs:GetLogRecord",
        "logs:FilterLogEvents"
      ]
      Resource = ["arn:aws:logs:*:*:*"]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "apigateway_logging" {
  role       = aws_iam_role.apigateway_logging.name
  policy_arn = aws_iam_policy.apigateway_logging.arn
}

# IAM Role for Bedrock Execution
resource "aws_iam_role" "bedrock_execution" {
  name = "${var.project_name}-bedrock-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "bedrock.amazonaws.com"
        }
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
          ArnLike = {
            "aws:SourceArn" = "arn:${data.aws_partition.current.partition}:bedrock:${var.aws_region}:${data.aws_caller_identity.current.account_id}:knowledge-base/*"
          }
        }
      }
    ]
  })

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_iam_role_policy" "bedrock_s3_documents" {
  name = "${var.project_name}-bedrock-s3-documents"
  role = aws_iam_role.bedrock_execution.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ListBucket"
        Action = "s3:ListBucket"
        Effect = "Allow"
        Resource = aws_s3_bucket.documents.arn
      },
      {
        Sid    = "GetObjects"
        Action = "s3:GetObject"
        Effect = "Allow"
        Resource = "${aws_s3_bucket.documents.arn}/*"
      }
    ]
  })
}

resource "aws_iam_role_policy" "bedrock_s3_vectors" {
  name = "${var.project_name}-bedrock-s3-vectors"
  role = aws_iam_role.bedrock_execution.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "VectorBucketS3Access"
        Action = [
          "s3:ListBucket",
          "s3:GetObject",
          "s3:PutObject"
        ]
        Effect = "Allow"
        Resource = [
          aws_s3vectors_vector_bucket.this.vector_bucket_arn,
          "${aws_s3vectors_vector_bucket.this.vector_bucket_arn}/*"
        ]
      },
      {
        Sid    = "VectorIndexAccess"
        Action = [
          "s3vectors:PutVectors",
          "s3vectors:GetVectors",
          "s3vectors:QueryVectors",
          "s3vectors:DeleteVectors"
        ]
        Effect = "Allow"
        Resource = "${aws_s3vectors_vector_bucket.this.vector_bucket_arn}/*"
      }
    ]
  })
}

resource "aws_iam_role_policy" "bedrock_invoke_models" {
  name = "${var.project_name}-bedrock-invoke-models"
  role = aws_iam_role.bedrock_execution.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "InvokeEmbeddingModel"
        Action = "bedrock:InvokeModel"
        Effect = "Allow"
        Resource = local.embedding_model_arn
      },
      {
        Sid    = "GetInferenceProfile"
        Action = "bedrock:GetInferenceProfile"
        Effect = "Allow"
        Resource = local.parsing_model_arn
      },
      {
        Sid    = "InvokeParsingModel"
        Action = "bedrock:InvokeModel"
        Effect = "Allow"
        Resource = [
          local.parsing_model_arn,
          "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
          "arn:aws:bedrock:us-east-2::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
          "arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0"
        ]
      }
    ]
  })
}
