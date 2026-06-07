# Technical Documentation — Sanket Custom Chatbot

## 1. Overview

The Sanket Custom Chatbot is a serverless **Retrieval-Augmented Generation (RAG)** platform. Users upload documents, the system indexes them into Amazon Bedrock Knowledge Bases, and users can then ask natural-language questions. The system retrieves relevant document chunks and generates answers using a large language model.

### Key Design Goals

- **Fully serverless** — zero infrastructure to manage
- **Multi-tenant** — each Cognito user gets isolated KBs (up to 10)
- **Dynamic KB creation** — KBs are created on-demand via the Bedrock API, not pre-provisioned
- **Cost-efficient** — S3 Vectors instead of OpenSearch Serverless; DynamoDB PAY_PER_REQUEST
- **Auditable** — full conversation history stored as Markdown in S3

---

## 2. Request Flow

### 2.1 Authentication Flow

```
User ──► Cognito ──► JWT Tokens ──► Frontend (localStorage)
                                        │
                              API call with Authorization: Bearer <idToken>
                                        │
                                   API Gateway ──► Lambda ──► validate_jwt_token()
```

- Frontend uses `@aws-sdk/client-cognito-identity-provider` for sign-up, sign-in, token refresh
- Tokens stored in `localStorage`: `accessToken`, `idToken`, `refreshToken`
- JWT validation in Lambda: base64-decode payload, extract `cognito:username` or `sub`
- No cryptographic verification (token was already issued by Cognito over HTTPS)

### 2.2 Create Knowledge Base Flow

```
User clicks "Create KB"
        │
        ▼
POST /kbs { name: "My KB" }
        │
        ▼
Lambda: kb_api.py
  1. Rate-limit check: COUNT(*) FROM kbs WHERE userId = X (max 10)
  2. Generate unique kbId
  3. s3vectors:CreateIndex in shared vector bucket (float32, 1024d, euclidean)
  4. bedrock:CreateKnowledgeBase with S3_VECTORS storage → new KB
  5. bedrock:CreateDataSource with FIXED_SIZE chunking (256 tokens, 10% overlap)
  6. Store metadata in DynamoDB kbs table
        │
        ▼
Returns { kbId, bedrockKbId, status: "CREATING" }
```

### 2.3 File Upload Flow

```
User selects file
        │
        ▼
POST /kbs/{id}/upload { filename: "report.pdf", contentType: "application/pdf" }
        │
        ▼
Lambda: Returns S3 presigned PUT URL
        │
        ▼
Frontend: PUT file directly to S3 using presigned URL
        │
        ▼
File lands at s3://bedrock-chat-docs-{random}/users/{userId}/kbs/{kbId}/report.pdf
```

### 2.4 Sync (Ingestion) Flow

```
User clicks "Sync Now"
        │
        ▼
POST /kbs/{id}/sync
        │
        ▼
Lambda: bedrock:StartIngestionJob
        │
        ▼
Frontend polls GET /kbs/{id}/sync every 5s
        │
        ▼
On COMPLETE → update DynamoDB documentCount
On FAILED  → store lastSyncError in DynamoDB
```

### 2.5 Chat (RetrieveAndGenerate) Flow

```
User types question
        │
        ▼
POST /chat { kbId, message, agentId?, conversationId? }
        │
        ▼
Lambda: chat_handler.py
  1. Look up KB from DynamoDB (get bedrockKbId)
  2. Look up agent instructions from DynamoDB agents table (if agentId provided)
  3. Call bedrock:RetrieveAndGenerate with:
     - knowledgeBaseConfiguration.knowledgeBaseId
     - knowledgeBaseConfiguration.modelArn (= Nova Micro)
     - Optional generationConfiguration.promptTemplate (with agent instructions)
        │
        ▼
  4. Parse response: output.text + citations[].retrievedReferences[].location.s3Location
        │
        ▼
  5. Append to S3 Markdown file:
     s3://bedrock-history-{random}/users/{userId}/conversations/{conversationId}.md
     Format:
     ### {timestamp}
     **User**: {question}
     **Assistant**: {answer}
     **Sources**: {s3 URIs}
        │
        ▼
  6. Upsert conversation metadata in DynamoDB:
     - First message → create item with title = first 100 chars of message
     - Subsequent → increment messageCount
        │
        ▼
Returns { response, sources[], conversationId }
```

### 2.6 History Search Flow

```
User types in search box
        │
        ▼
GET /history?search=keyword
        │
        ▼
Lambda: history_handler.py
  Query DynamoDB conversations table by userId
  Filter in-memory: contains match on title or conversationId
        │
        ▼
Returns list of conversations
        │
        ▼
User clicks one → GET /history/{id}
  Read Markdown content from S3
  Return { metadata, content }
```

---

## 3. Database Schema

### 3.1 DynamoDB: `bedrock-chat-kbs`

| Attribute | Type | Description |
|---|---|---|
| `userId` (PK) | S | Cognito username |
| `kbId` (SK) | S | Unique KB ID (`kb-{uuid}`) |
| `name` | S | User-provided KB name |
| `status` | S | CREATING, ACTIVE, FAILED, DELETING |
| `bedrockKbId` | S | AWS Bedrock KB ID |
| `dataSourceId` | S | Bedrock data source ID |
| `s3BucketName` | S | Document bucket name |
| `s3Prefix` | S | Key prefix (`users/{userId}/kbs/{kbId}/`) |
| `vectorIndexArn` | S | S3 Vector index ARN |
| `documentCount` | N | Number of indexed documents |
| `lastSyncStatus` | S | NONE, IN_PROGRESS, COMPLETE, FAILED |
| `lastSyncError` | S | Error message from last failed sync |
| `createdAt` | S | ISO 8601 timestamp |
| `updatedAt` | S | ISO 8601 timestamp |

**GSI**: `bedrockKbId-index` on `bedrockKbId`

### 3.2 DynamoDB: `bedrock-chat-agents`

| Attribute | Type | Description |
|---|---|---|
| `userId` (PK) | S | Cognito username |
| `agentId` (SK) | S | Unique agent ID |
| `kbId` | S | Associated KB ID |
| `name` | S | Agent name |
| `modelId` | S | Bedrock model ARN |
| `instructions` | S | Custom system prompt |
| `createdAt` | S | ISO 8601 timestamp |
| `updatedAt` | S | ISO 8601 timestamp |

**GSI**: `kbId-index` on `kbId`

### 3.3 DynamoDB: `bedrock-chat-conversations`

| Attribute | Type | Description |
|---|---|---|
| `userId` (PK) | S | Cognito username |
| `conversationId` (SK) | S | Unique conversation ID (`conv-{uuid}`) |
| `agentId` | S | Associated agent ID |
| `kbId` | S | Associated KB ID |
| `title` | S | First 100 chars of first message |
| `s3Key` | S | Path to MD file in history bucket |
| `messageCount` | N | Number of messages exchanged |
| `createdAt` | S | ISO 8601 timestamp |
| `updatedAt` | S | ISO 8601 timestamp |

**GSIs**: `agentId-index` on `agentId`, `kbId-index` on `kbId`

### 3.4 S3: Conversation History Format

Conversations are stored as Markdown files at:
```
s3://bedrock-history-{random}/users/{userId}/conversations/{conversationId}.md
```

```markdown
---
conversationId: conv-abc123
userId: user-xyz
kbId: kb-def456
agentId:
agentName:
createdAt: 2026-06-06T18:00:00
---

### 2026-06-06T18:00:00

**User**: What is our Q3 revenue?

**Assistant**: Based on the documents, Q3 revenue was $2.3M.

**Sources**:
- s3://bedrock-chat-docs-.../users/.../kb-.../q3-report.pdf
```

---

## 4. Lambda Functions Detail

### 4.1 `kb_api.py` — KB Management

| Route | Method | Handler Function | Description |
|---|---|---|---|
| `/kbs` | POST | `handle_create_kb` | Create Bedrock KB + S3 Vector index + data source |
| `/kbs` | GET | `handle_list_kbs` | List user's KBs from DynamoDB |
| `/kbs/{id}` | GET | `handle_get_kb` | Get single KB metadata |
| `/kbs/{id}` | DELETE | `handle_delete_kb` | Delete vector index + KB + data sources + S3 files |
| `/kbs/{id}/upload` | POST | `handle_upload_file` | Generate S3 presigned upload URL |
| `/kbs/{id}/files` | GET | `handle_list_files` | List files in S3 prefix |
| `/kbs/{id}/files/{file}` | DELETE | `handle_delete_file` | Delete file from S3 |
| `/kbs/{id}/sync` | POST | `handle_start_sync` | Start Bedrock ingestion job |
| `/kbs/{id}/sync` | GET | `handle_get_sync_status` | Poll ingestion job status |
| `/kbs/{id}/stats` | GET | `handle_get_stats` | File count, size, type breakdown |

**IAM permissions**: `bedrock:*`, `s3vectors:*`, `s3:*`, `dynamodb:*`, `iam:PassRole`

### 4.2 `chat_handler.py` — RAG Chat

| Route | Method | Description |
|---|---|---|
| `/chat` | POST | RetrieveAndGenerate + MD history persistence |

**IAM permissions**: `bedrock:RetrieveAndGenerate`, `s3:PutObject`/`GetObject`, `dynamodb:*`

### 4.3 `history_handler.py` — Conversation History

| Route | Method | Description |
|---|---|---|
| `/history` | GET | List conversations (with search filter) |
| `/history/{id}` | GET | Get full MD content from S3 |
| `/history/{id}` | DELETE | Delete S3 file + DynamoDB record |

**IAM permissions**: `s3:GetObject`/`DeleteObject`, `dynamodb:*`

---

## 5. API Gateway Routes

The REST API Gateway (HTTP protocol, v2) has 13 routes:

```
GET    /kbs                       → kb_api (list KBs)
POST   /kbs                       → kb_api (create KB)
GET    /kbs/{id}                  → kb_api (get KB)
DELETE /kbs/{id}                  → kb_api (delete KB)
POST   /kbs/{id}/upload            → kb_api (presigned URL)
GET    /kbs/{id}/files             → kb_api (list files)
DELETE /kbs/{id}/files/{file}      → kb_api (delete file)
POST   /kbs/{id}/sync              → kb_api (start sync)
GET    /kbs/{id}/sync              → kb_api (sync status)
GET    /kbs/{id}/stats             → kb_api (stats)
POST   /chat                       → chat_handler
GET    /history                    → history_handler
GET    /history/{id}               → history_handler
DELETE /history/{id}               → history_handler
OPTIONS /{proxy}                    → kb_api (CORS preflight)
```

All routes are CORS-enabled with `Access-Control-Allow-Origin: *`.

---

## 6. Frontend Architecture

### 6.1 Page Routing (Pages Router)

| Route | Page | Auth Required |
|---|---|---|
| `/` | `index.tsx` | No (landing) |
| `/login` | `login.tsx` | No |
| `/signup` | `signup.tsx` | No |
| `/confirm` | `confirm.tsx` | No |
| `/dashboard` | `dashboard.tsx` | Yes |
| `/kb/[id]` | `kb/[id].tsx` | Yes |
| `/chat/[kbId]` | `chat/[kbId].tsx` | Yes |
| `/history` | `history.tsx` | Yes |

### 6.2 Component Tree

```
App (_app.tsx)
├── AuthProvider (AuthContext)
│   └── AppProvider (AppContext)
│       └── Page
│           ├── Landing (index.tsx)
│           ├── Login / Signup / Confirm
│           ├── Dashboard
│           │   ├── Layout (sidebar)
│           │   ├── KBCard (grid)
│           │   └── KBCreateModal
│           ├── KB Detail
│           │   ├── FileUpload
│           │   ├── FileList
│           │   └── SyncStatus
│           ├── Chat
│           │   ├── ChatPanel
│           │   ├── AgentSelector
│           │   └── InstructionsEditor
│           └── History
│               └── HistorySearch
```

### 6.3 State Management

- **AuthContext**: user object, loading state, signIn/signUp/signOut functions
- **AppContext**: sidebar toggle, KB refresh trigger (counter incremented after mutations)
- **Local**: component-level state with `useState` + `useEffect`

### 6.4 API Client (`lib/api.ts`)

- Base URL from `NEXT_PUBLIC_API_ENDPOINT`
- Auth header: `Authorization: Bearer <idToken>` from localStorage
- All functions return parsed JSON or throw on non-OK response
- `uploadToS3()` does a raw PUT to the presigned URL (not via API Gateway)

---

## 7. Security

### 7.1 Authentication

- Cognito handles user registration, email verification, and password policies
- Frontend stores JWT tokens in browser `localStorage`
- Lambda validates JWT by base64-decoding the payload and extracting the user identity
- API Gateway has no built-in authorizer — Lambda handlers validate tokens inline

### 7.2 Authorization

- All Lambda operations check that `userId` from token matches `userId` in DynamoDB keys
- File operations are scoped to `users/{userId}/kbs/{kbId}/` prefix
- History operations are scoped to `users/{userId}/conversations/`

### 7.3 IAM

- Lambda execution role has least-privilege policies scoped to specific resources
- Bedrock execution role has a trust policy with `aws:SourceAccount` condition
- All S3 buckets are encrypted at rest (AES-256)
- S3 document bucket has CORS enabled for web uploads

---

## 8. File Reference

### `infrastructure/`

| File | Lines | Purpose |
|---|---|---|
| `main.tf` | 31 | TFC backend config (org: sanket-poc, workspace: sanket_custom_chatbot), AWS provider, locals |
| `variables.tf` | 88 | All configurable variables with defaults |
| `cognito.tf` | 83 | User pool, client, CloudWatch logging role |
| `dynamodb.tf` | 110 | Three DynamoDB tables with key schemas and GSIs |
| `s3.tf` | 60 | Document bucket, history bucket, vector bucket |
| `iam.tf` | 239 | Lambda role + policies, Bedrock execution role + policies, API Gateway logging role |
| `lambda.tf` | 109 | Three Lambda definitions with environment variables |
| `api_gateway.tf` | 228 | HTTP API, stage, 13 routes, integrations, Lambda permissions |
| `cloudwatch.tf` | 36 | Log groups for Lambda functions and API Gateway |
| `outputs.tf` | 65 | All resource IDs, ARNs, frontend config bundle |

### `backend/`

| File | Lines | Purpose |
|---|---|---|
| `utils.py` | 228 | Shared: JWT validation, DynamoDB helpers, S3 helpers, Bedrock clients, KB creation/teardown, ingestion management |
| `kb_api.py` | 280 | 10 route handlers for KB lifecycle management |
| `chat_handler.py` | 146 | RAG chat with RetrieveAndGenerate + MD history + DynamoDB metadata |
| `history_handler.py` | 106 | List/search/read/delete conversations |
| `build.ps1` | 15 | PowerShell script to zip Lambda packages |

### `frontend/`

| File/Dir | Purpose |
|---|---|
| `package.json` | Dependencies: next 14, react 18, lucide-react, @aws-sdk/client-cognito-identity-provider |
| `env.example` | Template for frontend config |
| `lib/auth.ts` | Cognito SDK wrapper: signUp, signIn, confirm, refresh tokens, localStorage persistence |
| `lib/api.ts` | REST API client: all 13 endpoints + S3 direct upload |
| `context/AuthContext.tsx` | React context: user state, auth functions, session restoration with token refresh |
| `context/AppContext.tsx` | React context: sidebar state, KB refresh trigger |
| `pages/` | 8 pages (see 6.1) |
| `components/` | 10 components (see 6.2) |
| `styles/globals.css` | Dark theme, animations, scrollbar, glass effect |
| `tailwind.config.js` | Custom color palette (primary, dark, accent), font families |

---

## 9. Environment Variables

### Lambda Environment Variables

| Variable | Set In | Purpose |
|---|---|---|
| `KB_TABLE_NAME` | kb_api, chat_handler | DynamoDB kbs table |
| `AGENTS_TABLE_NAME` | kb_api, chat_handler | DynamoDB agents table |
| `CONVERSATIONS_TABLE_NAME` | kb_api, chat_handler, history_handler | DynamoDB conversations table |
| `DOCUMENTS_BUCKET` | kb_api | S3 document bucket name |
| `HISTORY_BUCKET` | chat_handler, history_handler | S3 history bucket name |
| `VECTOR_BUCKET_NAME` | kb_api | S3 Vector bucket name |
| `BEDROCK_ROLE_ARN` | kb_api | Bedrock execution role ARN |
| `EMBEDDING_MODEL_ARN` | kb_api | Titan Text Embeddings v2 ARN |
| `CHAT_MODEL_ARN` | kb_api, chat_handler | Nova Micro ARN |
| `VECTOR_DIMENSION` | kb_api | Embedding dimension (1024) |
| `CHUNKING_STRATEGY` | kb_api | FIXED_SIZE |
| `FIXED_SIZE_MAX_TOKENS` | kb_api | 256 |
| `FIXED_SIZE_OVERLAP_PCT` | kb_api | 10 |
| `AWS_REGION` | All | us-east-1 |
| `LOG_LEVEL` | All | INFO |

### Frontend Environment Variables

| Variable | Source | Purpose |
|---|---|---|
| `NEXT_PUBLIC_AWS_REGION` | Fixed | AWS region |
| `NEXT_PUBLIC_USER_POOL_ID` | Terraform output | Cognito user pool ID |
| `NEXT_PUBLIC_USER_POOL_CLIENT_ID` | Terraform output | Cognito client ID |
| `NEXT_PUBLIC_API_ENDPOINT` | Terraform output | API Gateway URL |

---

## 10. Known Constraints

- **10 KBs per user**: hard-coded in `kb_api.py`
- **50MB file upload limit**: enforced in `FileUpload.tsx`
- **FIXED_SIZE chunking only**: required by S3 Vectors metadata size limit (2048 bytes)
- **Single chat model**: Amazon Nova Micro (switchable by updating `chat_model_id` variable)
- **Basic history search**: DynamoDB scan + in-memory filter (not full-text search)
- **No streaming**: chat response is returned synchronously (not streamed)
