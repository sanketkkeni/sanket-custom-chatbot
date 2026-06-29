data "aws_region" "current" {}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-kernel-6.1-*"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

# Cognito domain for OIDC hosted UI
resource "aws_cognito_user_pool_domain" "openwebui" {
  domain       = "${var.project_name}-${var.suffix}"
  user_pool_id = var.cognito_user_pool_id
}

# Cognito OIDC app client (confidential client with secret)
# Callback URL uses CloudFront domain (created later in this module)
resource "aws_cognito_user_pool_client" "openwebui" {
  name                = "${var.project_name}-openwebui"
  user_pool_id        = var.cognito_user_pool_id
  generate_secret     = true
  explicit_auth_flows = ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]

  callback_urls                        = ["https://${aws_cloudfront_distribution.openwebui.domain_name}/oauth/callback"]
  logout_urls                          = ["https://${aws_cloudfront_distribution.openwebui.domain_name}"]
  supported_identity_providers         = ["COGNITO"]
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["openid", "email", "profile"]

  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30
}

# Security group for Open Web UI (port 3000 only)
resource "aws_security_group" "openwebui" {
  name        = "${var.project_name}-openwebui"
  description = "Allow Open Web UI traffic"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "Open Web UI"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-openwebui"
    Environment = var.environment
    Project     = var.project_name
  }
}

# IAM role for EC2 (SSM Session Manager access)
resource "aws_iam_role" "openwebui_ec2" {
  name = "${var.project_name}-openwebui-ec2"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_iam_instance_profile" "openwebui_ec2" {
  name = "${var.project_name}-openwebui-ec2"
  role = aws_iam_role.openwebui_ec2.name
}

resource "aws_iam_role_policy_attachment" "openwebui_ec2_ssm" {
  role       = aws_iam_role.openwebui_ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Elastic IP for Open Web UI
resource "aws_eip" "openwebui" {
  domain = "vpc"

  tags = {
    Name        = "${var.project_name}-openwebui"
    Environment = var.environment
    Project     = var.project_name
  }
}

# EC2 instance for Open Web UI
resource "aws_instance" "openwebui" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = "t3.micro"
  subnet_id              = data.aws_subnets.default.ids[0]
  vpc_security_group_ids = [aws_security_group.openwebui.id]
  iam_instance_profile   = aws_iam_instance_profile.openwebui_ec2.name
  user_data = <<-EOF
#!/bin/bash
exec > /var/log/user_data.log 2>&1
set -x

# Create 1GB swap to survive Docker pull without OOM
dd if=/dev/zero of=/swapfile bs=1M count=1024
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Protect SSM agent from OOM
echo -1000 > /proc/$(pgrep -f amazon-ssm-agent)/oom_score_adj 2>/dev/null || true

yum install -y -q docker
systemctl enable docker
systemctl start docker

# Start Open Web UI in background so cloud-init finishes immediately
# and SSM agent stays operational. The docker pull runs async.
nohup bash -c '
docker pull ghcr.io/open-webui/open-webui:main && \
docker run -d \
  --name openwebui \
  --restart always \
  -p 3000:8080 \
  --memory="512m" \
  --memory-reservation="256m" \
  -e WEBUI_SECRET_KEY="${var.webui_secret_key}" \
  -e OPENAI_API_BASE_URL="${var.api_gateway_endpoint}/v1" \
  -e OPENAI_API_KEY="${var.openai_api_key}" \
  -e ENABLE_FORWARD_USER_INFO_HEADERS=true \
  -e RAG_EMBEDDING_ENGINE=openai \
  -e THREAD_POOL_SIZE=40 \
  -e DATABASE_POOL_SIZE=8 \
  -e DATABASE_ENABLE_SESSION_SHARING=false \
  -e ENABLE_REALTIME_CHAT_SAVE=false \
  -e AUDIO_STT_ENGINE=webapi \
  -e ENABLE_IMAGE_GENERATION=false \
  -e ENABLE_CODE_INTERPRETER=false \
  ghcr.io/open-webui/open-webui:main
' > /var/log/openwebui.log 2>&1 &
EOF

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  user_data_replace_on_change = true

  tags = {
    Name        = "${var.project_name}-openwebui"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_eip_association" "openwebui" {
  instance_id   = aws_instance.openwebui.id
  allocation_id = aws_eip.openwebui.id
}

# CloudFront distribution for HTTPS front-end
resource "aws_cloudfront_distribution" "openwebui" {
  enabled             = true
  default_root_object = ""
  is_ipv6_enabled     = true
  price_class         = "PriceClass_100"

  origin {
    domain_name = aws_instance.openwebui.public_dns
    origin_id   = "openwebui-origin"

    custom_origin_config {
      http_port              = 3000
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "openwebui-origin"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = true
      cookies {
        forward = "all"
      }
      headers = ["*"]
    }

    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = {
    Name        = "${var.project_name}-openwebui"
    Environment = var.environment
    Project     = var.project_name
  }
}
