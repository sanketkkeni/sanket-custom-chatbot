output "ec2_public_ip" {
  description = "Public IP of the Open Web UI EC2 instance"
  value       = aws_eip.openwebui.public_ip
}

output "cloudfront_domain" {
  description = "CloudFront domain name for Open Web UI"
  value       = aws_cloudfront_distribution.openwebui.domain_name
}

output "openwebui_url" {
  description = "URL to access Open Web UI (via CloudFront HTTPS)"
  value       = "https://${aws_cloudfront_distribution.openwebui.domain_name}"
}

output "oidc_client_id" {
  description = "Cognito OIDC client ID for Open Web UI"
  value       = aws_cognito_user_pool_client.openwebui.id
}
