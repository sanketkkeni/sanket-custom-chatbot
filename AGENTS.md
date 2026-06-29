# AGENTS.md — Sanket Custom Chatbot

## Conventions

### Project
- Location: `C:\_src\opencode\sanket_custom_chatbot`
- Terraform Cloud workspace: `sanket-poc/sanket_custom_chatbot`
- All resources created fresh (no reuse from bedrock-kb workspace)

### Stack
- Frontend: Next.js 14 (Pages Router), React 18, Tailwind CSS, lucide-react
- Backend: Python 3.13 AWS Lambda
- Auth: Cognito (USER_PASSWORD_AUTH, same pattern as messenger)
- API: API Gateway REST (HTTP protocol, v2)
- Database: DynamoDB (PAY_PER_REQUEST)
- Storage: S3 (documents, conversation MD files)
- Vector: S3 Vectors (shared bucket, unique index per KB)
- AI: Bedrock Knowledge Bases, Claude Sonnet 4.6 via inference profile (RetrieveAndGenerate + document parsing + multimodal parsing), Titan Text Embeddings v2

### Naming
- Terraform project_name: "bedrock-chat"
- All resources prefixed with `bedrock-chat-`
- Lambda functions: `bedrock-chat-kb-api`, `bedrock-chat-chat-handler`, `bedrock-chat-history-handler`, `bedrock-chat-openai-proxy`
- DynamoDB tables: `bedrock-chat-kbs`, `bedrock-chat-agents`, `bedrock-chat-conversations`
- S3 buckets: `bedrock-chat-docs-{random}`, `bedrock-history-{env}`

### Patterns (from messenger app)
- Cognito User Pool: username_attributes = ["email"], auto_verified_attributes = ["email"]
- Auth flow: ADMIN_NO_SRP_AUTH, USER_PASSWORD_AUTH
- JWT validation: base64 decode payload, extract cognito:username or sub
- Lambda zip packaging: build.ps1 with Compress-Archive
- API Gateway CORS: allow_origins = ["*"], methods GET/POST/DELETE/OPTIONS
- Frontend auth: AuthContext with localStorage token storage
- Tailwind config: dark theme with primary/dark/accent colors
- CSS: glass-dark cards, dark-900 background

### Lambda Handler Pattern
```python
import json
from utils import validate_jwt_token, create_response

CORS_HEADERS = { ... }

def lambda_handler(event, context):
    # 1. Handle OPTIONS preflight
    # 2. Extract + validate JWT
    # 3. Route based on method/route
    # 4. Return response with CORS headers
```

### File Structure
```
project/
├── infrastructure/    # Terraform
├── backend/           # Python Lambda
├── frontend/          # Next.js
├── AGENTS.md
├── README.md
└── PLAN.md
```

### Configuration
- Parsing: `BEDROCK_FOUNDATION_MODEL` using `us.anthropic.claude-sonnet-4-6` inference profile with `parsingModality: MULTIMODAL`
- Chat model: `us.anthropic.claude-sonnet-4-6` inference profile
- Embedding: `amazon.titan-embed-text-v2:0` (1024 dimensions, FLOAT32)
- Chunking: `SEMANTIC` (breakpointPercentileThreshold=95, bufferSize=0, maxTokens=512)
- Both parsing and chunking are immutable after data source creation — must delete/recreate data source to change
- `parsingConfiguration` with `parsingModality: MULTIMODAL` is also immutable — must delete/recreate data source
- Multimodal storage S3 bucket is required for JPG/PNG image support in KB
- For converse/invoke testing, use inference profile ARN (e.g., `us.anthropic.claude-sonnet-4-6`), NOT the base model ID (`anthropic.claude-sonnet-4-6`)
- For Sonnet 4.6, the first invocation from any IAM user triggers auto-subscription via AWS Marketplace (requires `aws-marketplace:Subscribe` + `aws-marketplace:ViewSubscriptions` on the IAM user) — after that, all roles in the account can use it

### Commands
- Terraform: `cd infrastructure; terraform init; terraform plan -out plan.tfplan; terraform apply plan.tfplan`
- Build Lambdas: `cd backend; ./build.ps1`
- Dev server: `cd frontend; npm run dev`
- Update Lambda directly: `aws lambda update-function-code --function-name <name> --zip-file fileb://infrastructure/<name>.zip`

### Lambda Layer Build (Pillow)
- When building the Pillow Lambda layer, the `Compress-Archive` must zip the `python` **directory** (not its contents) to preserve the `python/` prefix required by Lambda runtimes
- Correct: `Compress-Archive -Path "python" -DestinationPath "pillow-layer.zip"`
- Wrong: `Compress-Archive -Path "python\*" -DestinationPath "pillow-layer.zip"` (creates flat zip without prefix)

### Open Web UI / OpenAI Proxy
- Lambda: `bedrock-chat-openai-proxy` in `infrastructure/modules/openwebui/`
- Routes: `GET /v1/models` and `POST /v1/chat/completions`
- Auth: Shared `x-api-key` header (validated in Lambda against `OPENAI_API_KEY` env var)
- **User isolation: No Open Web UI fork needed.** Set `ENABLE_FORWARD_USER_INFO_HEADERS=true` on the Open Web UI container
- Open Web UI automatically sends `X-OpenWebUI-User-Id` header on every request to the upstream proxy
- The proxy reads this header and filters KBs by that `userId` using DynamoDB Query (not Scan)
- For `/v1/chat/completions`, the proxy does a `get_item` check to verify the KB belongs to the user before calling Bedrock
- Open Web UI alternative: Custom headers in `OPENAI_API_CONFIGS` with `{{USER_ID}}` template variable (works without env var)
- Zip location: `infrastructure/modules/openwebui/openai_proxy.zip` (built by build.ps1)
- Terraform module: `infrastructure/modules/openwebui/` — takes API Gateway ID + execution ARN, adds routes/integration to existing HTTP API
- CORS: `x-api-key` and `X-Api-Key` added to allowed headers in API Gateway

### Open Web UI EC2 Deployment Lessons
- **Cognito OIDC callback URLs require HTTPS.** Cognito blocks HTTP callback URLs for non-localhost addresses. Always use HTTPS.
- **CloudFront > self-signed cert.** CloudFront's default `*.cloudfront.net` certificate is free, browser-trusted, and avoids nginx/cert management on EC2. Self-signed certs trigger browser warnings and add unnecessary complexity.
- **SSM commands queue during cloud-init.** Long-running user data scripts (especially `yum update`) block SSM commands until they finish. Pending commands during provisioning is normal.
- **Don't embed OIDC creds in user_data.** Creates circular dependencies between EC2, CloudFront, and Cognito client. Configure OIDC via Open Web UI Admin Settings post-deploy instead.
- **Keep EC2 simple.** Just Docker + container. Put TLS termination in CloudFront, not on the instance.
- **Use `user_data`, not `user_data_base64`.** Terraform AWS provider auto-encodes. Using `base64encode()` with `user_data` triggers a deprecation warning.

### Open Web UI EC2 Deployment Steps (correct)
1. EC2 (public subnet) + EIP + SG (port 3000) — no nginx, no self-signed cert
2. User data: install Docker, run `ghcr.io/open-webui/open-webui:main` on port 3000
3. CloudFront distribution (origin = EIP:3000, HTTP-only, redirect-to-https viewer)
4. Cognito OIDC client: callback URL = `https://{cloudfront_domain}/oauth/callback`
5. After deploy: configure OpenAI connection + OIDC in Open Web UI Admin Settings
6. CloudFront default cert provides trusted HTTPS — no self-signed cert needed

### Documentation
- When fixing a bug, document the issue in `all_issues_faced_and_how_it_was_fixed.md`
- Include: symptom, root cause, fix applied, files changed
