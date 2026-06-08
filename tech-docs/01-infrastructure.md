# Infrastructure Reference

## Terraform Configuration

- **Backend**: Terraform Cloud (organization `sanket-poc`, workspace `sanket_custom_chatbot`)
- **Provider**: AWS `>= 6.27.0, < 7.0.0`, Random `~> 3.6`
- **Region**: `us-east-1`
- **Prefix**: All resources prefixed with `bedrock-chat-`

## AWS Resources

### Cognito

| Resource | Name | Details |
|----------|------|---------|
| User Pool | `bedrock-chat-users` | `username_attributes = ["email"]`, `auto_verified_attributes = ["email"]` |
| Client | `bedrock-chat-client` | `explicit_auth_flows = ["ADMIN_NO_SRP_AUTH", "USER_PASSWORD_AUTH"]` |
| Logging Role | `bedrock-chat-cognito-logging` | IAM role for Cognito CloudWatch delivery |

### DynamoDB

| Table | HASH | SORT | GSIs | Billing |
|-------|------|------|------|---------|
| `bedrock-chat-kbs` | `userId` | `kbId` | `bedrockKbId-index` | PAY_PER_REQUEST |
| `bedrock-chat-agents` | `userId` | `agentId` | `kbId-index` | PAY_PER_REQUEST |
| `bedrock-chat-conversations` | `userId` | `conversationId` | `agentId-index`, `kbId-index` | PAY_PER_REQUEST |

### S3

| Bucket | Purpose | Key Structure |
|--------|---------|---------------|
| `bedrock-chat-docs-{random8}` | Document storage | `users/{userId}/kbs/{kbId}/{filename}` |
| `bedrock-history-{random8}` | Chat history | `users/{userId}/conversations/{conversationId}.md` |

Both: Versioning enabled, AES-256 encryption.

### S3 Vectors

| Resource | Details |
|----------|---------|
| Vector Bucket | `bedrock-chat-vectors` |
| Index name | `idx-{kbId}` |
| Dimension | 1024 |
| Data type | `float32` |
| Distance metric | `euclidean` |
| Non-filterable keys | `['AMAZON_BEDROCK_TEXT', 'AMAZON_BEDROCK_METADATA']` |

### Lambda Functions

#### `bedrock-chat-kb-api`

- **Handler**: `kb_api.lambda_handler`
- **Runtime**: Python 3.13
- **Timeout**: 120s
- **Memory**: 512 MB
- **Zip**: `kb_api.zip` (includes `kb_api.py` + `utils.py`)

**Environment Variables**:

| Variable | Source |
|----------|--------|
| `KB_TABLE_NAME` | DynamoDB kbs table name |
| `AGENTS_TABLE_NAME` | DynamoDB agents table name |
| `CONVERSATIONS_TABLE_NAME` | DynamoDB conversations table name |
| `DOCUMENTS_BUCKET` | S3 documents bucket name |
| `VECTOR_BUCKET_NAME` | S3 Vectors bucket name |
| `BEDROCK_ROLE_ARN` | Bedrock execution role ARN |
| `EMBEDDING_MODEL_ARN` | Titan Text Embeddings v2 ARN |
| `CHAT_MODEL_ARN` | Claude Haiku 4.5 inference profile ARN |
| `VECTOR_DIMENSION` | `1024` |
| `CHUNKING_STRATEGY` | `SEMANTIC` (default) |
| `FIXED_SIZE_MAX_TOKENS` | `512` |
| `FIXED_SIZE_OVERLAP_PCT` | `10` |
| `PARSING_MODEL_ARN` | Claude Haiku 4.5 inference profile ARN |
| `SEMANTIC_CHUNKING_BREAKPOINT_PCT` | `95` |
| `SEMANTIC_CHUNKING_BUFFER_SIZE` | `0` |
| `SEMANTIC_CHUNKING_MAX_TOKENS` | `512` |
| `LOG_LEVEL` | `INFO` |

#### `bedrock-chat-chat-handler`

- **Handler**: `chat_handler.lambda_handler`
- **Zip**: `chat_handler.zip` (includes `chat_handler.py` + `utils.py`)

**Environment Variables**: `KB_TABLE_NAME`, `AGENTS_TABLE_NAME`, `CONVERSATIONS_TABLE_NAME`, `HISTORY_BUCKET`, `CHAT_MODEL_ARN`, `LOG_LEVEL`

#### `bedrock-chat-history-handler`

- **Handler**: `history_handler.lambda_handler`
- **Zip**: `history_handler.zip` (includes `history_handler.py` + `utils.py`)

**Environment Variables**: `CONVERSATIONS_TABLE_NAME`, `HISTORY_BUCKET`, `LOG_LEVEL`

### API Gateway

**Type**: HTTP API v2

**Routes** (all `AWS_PROXY` integration):

| Route | Lambda | CORS |
|-------|--------|------|
| `GET /kbs` | kb_api | Yes |
| `POST /kbs` | kb_api | Yes |
| `GET /kbs/{id}` | kb_api | Yes |
| `DELETE /kbs/{id}` | kb_api | Yes |
| `POST /kbs/{id}/upload` | kb_api | Yes |
| `GET /kbs/{id}/files` | kb_api | Yes |
| `DELETE /kbs/{id}/files/{file}` | kb_api | Yes |
| `POST /kbs/{id}/sync` | kb_api | Yes |
| `GET /kbs/{id}/sync` | kb_api | Yes |
| `GET /kbs/{id}/stats` | kb_api | Yes |
| `POST /chat` | chat_handler | Yes |
| `GET /history` | history_handler | Yes |
| `GET /history/{id}` | history_handler | Yes |
| `DELETE /history/{id}` | history_handler | Yes |
| `OPTIONS /{proxy}` | kb_api (CORS preflight) | Yes |

**Stage**: `$default`, auto-deploy enabled.
**Throttling**: burst 1000, rate 500.

### IAM Roles

#### Lambda Role (`bedrock-chat-lambda-role`)

Trusts: `lambda.amazonaws.com`

Policies:
- `AWSLambdaBasicExecutionRole` (managed)
- **DynamoDB**: `GetItem`, `PutItem`, `UpdateItem`, `DeleteItem`, `Query`, `Scan` on all 3 tables and GSIs
- **S3 Documents**: `PutObject`, `GetObject`, `DeleteObject`, `ListBucket`
- **S3 History**: `PutObject`, `GetObject`, `DeleteObject`, `ListBucket`
- **Cognito**: `ListUsers`, `AdminGetUser`
- **Bedrock**: Full KB management (`Create/Delete/Get/ListKnowledgeBase`, `Create/Delete/Get/ListDataSource`, `Start/Get/ListIngestionJob`), `InvokeModel` (embedding + inference profile + 3 US region foundation model ARNs), `GetInferenceProfile`, `aws-marketplace:Subscribe`, `aws-marketplace:ViewSubscriptions`
- **S3 Vectors**: `CreateIndex`, `DeleteIndex`, `GetIndex`, `ListIndexes`
- **IAM**: `PassRole` on Bedrock execution role

#### Bedrock Execution Role (`bedrock-chat-bedrock-role`)

Trusts: `bedrock.amazonaws.com` (with `aws:SourceAccount` and `aws:SourceArn` conditions)

Policies:
- **S3 Documents**: `ListBucket`, `GetObject`
- **S3 Vectors**: Full S3 vectors CRUD + `s3:ListBucket/GetObject/PutObject`
- **Bedrock Invoke**: `InvokeModel` on Titan Embeddings v2, `GetInferenceProfile` + `InvokeModel` on Claude Haiku 4.5 inference profile, `InvokeModel` on 3 US region foundation model ARNs (`us-east-1`, `us-east-2`, `us-west-2`)

### CloudWatch

| Log Group | Retention |
|-----------|-----------|
| `/aws/lambda/bedrock-chat-kb-api` | 30 days |
| `/aws/lambda/bedrock-chat-chat-handler` | 30 days |
| `/aws/lambda/bedrock-chat-history-handler` | 30 days |
| `/aws/apigateway/bedrock-chat/rest` | 30 days |
| `/aws/cognito/bedrock-chat-users` | 30 days |
