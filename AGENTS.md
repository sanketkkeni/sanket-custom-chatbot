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
- Lambda functions: `bedrock-chat-kb-api`, `bedrock-chat-chat-handler`, `bedrock-chat-history-handler`
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

### Documentation
- When fixing a bug, document the issue in `all_issues_faced_and_how_it_was_fixed.md`
- Include: symptom, root cause, fix applied, files changed
