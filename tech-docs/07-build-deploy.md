# Build & Deploy

## GitHub Repository

- **URL**: `https://github.com/sanketkkeni/sanket-custom-chatbot`
- **Default branch**: `main`
- **CI/CD**: Manual (push to `main`, then deploy separately)

---

## Backend Deployment

### Prerequisites

- AWS CLI configured with appropriate credentials
- Terraform CLI (`>= 1.15.2`)
- Terraform Cloud account (organization: `sanket-poc`, workspace: `sanket_custom_chatbot`)
- PowerShell 5.1+ (for build script)

### Build Lambda Packages

```powershell
cd backend
./build.ps1
```

Outputs to `infrastructure/`:
| Zip | Contents |
|-----|----------|
| `kb_api.zip` | `kb_api.py` + `utils.py` |
| `chat_handler.zip` | `chat_handler.py` + `utils.py` |
| `history_handler.zip` | `history_handler.py` + `utils.py` |
| `utils.zip` | `utils.py` only |

Each Lambda zip includes `utils.py` as a shared module. Python resolves it from the same directory at import time.

### Full Terraform Apply

```powershell
cd infrastructure
terraform init
terraform plan -out plan.tfplan
terraform apply plan.tfplan
```

### Quick Lambda Code Update (no Terraform)

For rapid iteration on Lambda code only (no infrastructure changes):

```powershell
# After running build.ps1
aws lambda update-function-code --function-name bedrock-chat-kb-api --zip-file fileb://infrastructure/kb_api.zip
aws lambda update-function-code --function-name bedrock-chat-chat-handler --zip-file fileb://infrastructure/chat_handler.zip
aws lambda update-function-code --function-name bedrock-chat-history-handler --zip-file fileb://infrastructure/history_handler.zip
```

**Important**: Always run `build.ps1` first and ensure the zip files are rebuilt from the `backend/` source. The build script outputs directly to `infrastructure/` now, but verify the timestamp/hash if unsure.

---

## Frontend Deployment

### Vercel (Production)

- **Project**: `sanket-custom-chatbot`
- **Root directory**: `frontend/`
- **Build command**: `next build`
- **Output directory**: `.next`
- **Auto-deploy**: On push to `main`

### Environment Variables (required on Vercel)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_AWS_REGION` | `us-east-1` |
| `NEXT_PUBLIC_USER_POOL_ID` | From Terraform output |
| `NEXT_PUBLIC_USER_POOL_CLIENT_ID` | From Terraform output |
| `NEXT_PUBLIC_API_ENDPOINT` | From Terraform output (API Gateway URL) |

### Local Development

```powershell
cd frontend
npm run dev
```

Requires `.env.local` with the same variables.

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────┐
│                GitHub (main)                     │
│                                                   │
│  ├── backend/    (Lambda source code)            │
│  ├── frontend/   (Next.js source)                │
│  └── infrastructure/  (Terraform + zip files)     │
└────────┬──────────────┬──────────────────────────┘
         │              │
         ▼              ▼
    Terraform         Vercel
    Cloud             (auto-deploy)
    Apply
         │              │
         ▼              ▼
    AWS Cloud         Served at:
    (Lambda,          https://sanket-custom-chatbot.vercel.app
    DynamoDB, S3,
    API Gateway,
    Bedrock...)
```

---

## Local Testing

Test payloads available in project root:
- `payload.json` — Sample API Gateway event for `GET /kbs`
- `response.json` — Sample Lambda response
- `list_kbs_test.json` — DynamoDB query result mock

### Lambda Local Invocation

```powershell
# Using AWS SAM CLI or direct Python
cd backend
python -c "
from kb_api import lambda_handler
import json
with open('../payload.json') as f:
    event = json.load(f)
result = lambda_handler(event, None)
print(json.dumps(result, indent=2))
"
```

---

## Common Operations

| Task | Command |
|------|---------|
| Build Lambda zips | `cd backend; ./build.ps1` |
| Update single Lambda | `aws lambda update-function-code --function-name <name> --zip-file fileb://infrastructure/<name>.zip` |
| View Lambda logs | `aws logs tail /aws/lambda/bedrock-chat-kb-api --follow` |
| Run frontend dev | `cd frontend; npm run dev` |
| Build frontend | `cd frontend; npm run build` |
| Apply Terraform | `cd infrastructure; terraform apply plan.tfplan` |
| Check DynamoDB | `aws dynamodb scan --table-name bedrock-chat-kbs --output table` |
| List Bedrock KBs | `aws bedrock-agent list-knowledge-bases --output table` |
| Delete orphaned KB | `aws bedrock-agent delete-knowledge-base --knowledge-base-id <id>` |
