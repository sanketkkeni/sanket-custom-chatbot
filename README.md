# Sanket Custom Chatbot

A full-stack **Retrieval-Augmented Generation (RAG)** application that lets users create, manage, and chat with their own Bedrock Knowledge Bases — all through a clean web interface.

Built with Next.js, AWS Lambda, Cognito, DynamoDB, and Amazon Bedrock.

---

## Features

- **User Authentication** — Sign up and sign in via AWS Cognito with email verification
- **Knowledge Base Management** — Create up to 10 KBs per user, each backed by its own S3 Vector index
- **File Upload** — Drag-and-drop file upload via S3 presigned URLs (PDF, TXT, MD, HTML, DOCX, CSV, XLSX)
- **One-Click Sync** — Trigger Bedrock ingestion jobs and poll real-time status
- **RAG Chat** — Ask natural-language questions against your documents using Amazon Nova Micro
- **Source Citations** — Every answer shows which documents were used as sources
- **Conversation History** — Full chat history stored as Markdown in S3, searchable via DynamoDB
- **Agent Instructions** — Configure custom system prompts per agent (future: multi-agent selector)

---

## Architecture

```
Browser ──► Vercel ──► API Gateway ──► Lambda ──► DynamoDB
                 │                      ├──► S3 Vectors
                 │                      ├──► Bedrock KB
                 │                      └──► S3 (docs / history)
                 └──► Cognito (auth)
```

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (Pages Router), React 18, Tailwind CSS, lucide-react |
| **Backend** | Python 3.13 Lambda (3 functions: KB API, Chat, History) |
| **Auth** | AWS Cognito (USER_PASSWORD_AUTH, JWT tokens) |
| **API** | API Gateway HTTP (REST, auto-deploy, CORS enabled) |
| **Metadata** | DynamoDB (PAY_PER_REQUEST, 3 tables with GSIs) |
| **Documents** | S3 (versioned, encrypted, CORS-configured) |
| **Vectors** | S3 Vectors (shared bucket, unique index per user KB) |
| **AI** | Amazon Bedrock — Titan Text Embeddings v2, Amazon Nova Micro |

---

## Project Structure

```
C:\_src\opencode\sanket_custom_chatbot\
├── infrastructure/          # Terraform (TFC workspace: sanket-poc/sanket_custom_chatbot)
│   ├── main.tf             # TFC backend + provider config
│   ├── variables.tf        # All configurable variables
│   ├── cognito.tf          # User pool + client
│   ├── dynamodb.tf         # kbs, agents, conversations tables + GSIs
│   ├── s3.tf               # Document bucket, history bucket, vector bucket
│   ├── iam.tf              # Lambda + Bedrock execution roles + policies
│   ├── lambda.tf           # 3 Lambda function definitions
│   ├── api_gateway.tf      # REST API + 13 routes + CORS + Lambda permissions
│   ├── cloudwatch.tf       # Log groups
│   └── outputs.tf          # Endpoints, IDs, frontend config
├── backend/                 # Python Lambda source
│   ├── utils.py            # Shared: JWT auth, DynamoDB ops, Bedrock clients, S3 helpers
│   ├── kb_api.py           # KB CRUD, file upload, sync management (10 endpoints)
│   ├── chat_handler.py     # RAG chat + Markdown history persistence
│   ├── history_handler.py  # Conversation list/search/read/delete
│   └── build.ps1           # Zip packager for all Lambda functions
├── frontend/                # Next.js application
│   ├── context/            # AuthContext (Cognito), AppContext (sidebar, refresh)
│   ├── lib/                # auth.ts (Cognito SDK), api.ts (REST client)
│   ├── pages/              # 8 pages: index, login, signup, confirm, dashboard, kb/[id], chat/[kbId], history
│   ├── components/         # 10 reusable components
│   └── styles/             # Tailwind globals (dark theme)
├── AGENTS.md               # Convention reference for AI coding assistants
├── DOCS.md                 # Technical documentation
└── README.md               # This file
```

---

## Prerequisites

| Tool | Version |
|---|---|
| [Terraform](https://developer.hashicorp.com/terraform/install) | ≥ 1.15.2 |
| [AWS CLI](https://aws.amazon.com/cli/) | Latest |
| [Node.js](https://nodejs.org/) | ≥ 18 |
| Terraform Cloud account | Organization: `sanket-poc` |

---

## Deployment

### 1. Create Terraform Cloud Workspace

Create a new workspace named **`sanket_custom_chatbot`** in the `sanket-poc` organization.
Add these workspace environment variables:

| Variable | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | (your AWS access key) |
| `AWS_SECRET_ACCESS_KEY` | (your AWS secret key) |
| `AWS_REGION` | `us-east-1` |

### 2. Deploy AWS Infrastructure

```powershell
cd infrastructure
terraform init
terraform plan -out plan.tfplan
terraform apply plan.tfplan
```

Save the **outputs** — you'll need them for the frontend.

### 3. Build Lambda Packages

```powershell
cd backend
./build.ps1

# Copy zips to infrastructure for next terraform apply
Copy-Item kb_api.zip,chat_handler.zip,history_handler.zip ../infrastructure/
```

> Run `build.ps1` and copy zips **before** running terraform apply, or the Lambda resource creation will fail.

### 4. Configure & Run Frontend

```powershell
cd frontend
npm install
```

Copy `.env.example` to `.env.local` and fill in values from the terraform outputs:

```env
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_USER_POOL_ID=<user_pool_id>
NEXT_PUBLIC_USER_POOL_CLIENT_ID=<user_pool_client_id>
NEXT_PUBLIC_API_ENDPOINT=<rest_api_endpoint>
```

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Resources Created

| Resource | Name Pattern |
|---|---|
| Cognito User Pool | `bedrock-chat-users` |
| Cognito Client | `bedrock-chat-client` |
| DynamoDB (KBs) | `bedrock-chat-kbs` |
| DynamoDB (Agents) | `bedrock-chat-agents` |
| DynamoDB (Conversations) | `bedrock-chat-conversations` |
| S3 (Documents) | `bedrock-chat-docs-{random8}` |
| S3 (History) | `bedrock-history-{random8}` |
| S3 Vector Bucket | `bedrock-chat-vectors` |
| Lambda (KB API) | `bedrock-chat-kb-api` |
| Lambda (Chat) | `bedrock-chat-chat-handler` |
| Lambda (History) | `bedrock-chat-history-handler` |
| API Gateway | `bedrock-chat-api` |
| IAM Role (Lambda) | `bedrock-chat-lambda-role` |
| IAM Role (Bedrock) | `bedrock-chat-bedrock-role` |

---

## Clean Up

```powershell
cd infrastructure
terraform destroy
```

> **Note**: Empty S3 buckets first, or `terraform destroy` will fail. You can empty them via the AWS Console or:
> ```powershell
> aws s3 rm s3://bedrock-chat-docs-XXXXXX --recursive
> aws s3 rm s3://bedrock-history-XXXXXX --recursive
> ```
