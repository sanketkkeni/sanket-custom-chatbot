# Backend — Lambda Handlers

All Lambda functions are Python 3.13, packaged as zip files containing the handler module + `utils.py` (shared module).

## Shared Module: `utils.py`

**File**: `backend/utils.py`

**AWS Clients**:

| Client | Initialization |
|--------|---------------|
| `dynamodb` | `boto3.resource('dynamodb')` |
| `s3` | `boto3.client('s3')` |
| `bedrock` | `boto3.client('bedrock')` |
| `bedrock_agent` | `boto3.client('bedrock-agent')` |
| `bedrock_agent_runtime` | `boto3.client('bedrock-agent-runtime')` |
| `s3vectors` | `boto3.client('s3vectors')` |
| `sts` | `boto3.client('sts')` |

**Key Utility Functions**:

| Function | Signature | Description |
|----------|-----------|-------------|
| `create_response` | `(status_code, body) -> dict` | Builds API Gateway response with CORS headers |
| `validate_jwt_token` | `(token) -> str or None` | Base64-decode JWT, extract `cognito:username` or `sub` |
| `get_user_from_event` | `(event) -> str or None` | Extract user from `Authorization` header |
| `handle_options` | `(event) -> dict or None` | Return 200 for OPTIONS preflight requests |
| `generate_kb_id` | `() -> str` | `kb-{uuid4.hex[:12]}` |
| `generate_agent_id` | `() -> str` | `agent-{uuid4.hex[:12]}` |
| `generate_conversation_id` | `() -> str` | `conv-{uuid4.hex[:12]}` |
| `get_account_id` | `() -> str` | STS GetCallerIdentity Account ID |
| `create_knowledge_base` | `(user_id, kb_id, name) -> tuple` | Creates S3 Vector index + Bedrock KB + data source |
| `delete_knowledge_base` | `(bedrock_kb_id, index_arn)` | Deletes data sources, KB, and S3 Vector index |
| `start_ingestion` | `(bedrock_kb_id, data_source_id) -> str` | Starts Bedrock ingestion job |
| `get_ingestion_status` | `(bedrock_kb_id, data_source_id, job_id) -> dict` | Polls ingestion job progress + statistics |
| `list_s3_files` | `(bucket, prefix) -> list` | Paginates and lists S3 files with metadata |
| `refresh_kb_status` | `(user_id, kb_id, bedrock_kb_id) -> str or None` | Checks Bedrock for actual KB status |
| `refresh_document_count` | `(user_id, kb_id, s3_prefix) -> int or None` | Re-counts S3 files |
| `refresh_kb_sync_status` | `(user_id, kb_id, bedrock_kb_id, data_source_id, job_id) -> str or None` | Fixes stuck IN_PROGRESS ingestion |
| `get_presigned_url` | `(bucket, key, content_type) -> str` | Generates S3 presigned PUT URL (3600s) |

### `create_knowledge_base()` Flow

1. Create S3 Vector index: `s3vectors.create_index(vectorBucketName, indexName="idx-{kbId}", dataType='float32', dimension=1024, distanceMetric='euclidean')`
2. Create Bedrock KB: `bedrock_agent.create_knowledge_base(name, roleArn, vectorIndexArn, embeddingModelArn)` with `VECTOR` type + `S3_VECTORS` storage
3. Create data source: `bedrock_agent.create_data_source(kbId, s3Bucket, s3Prefix, chunkingConfig, parsingConfig)` with `dataDeletionPolicy='RETAIN'`
4. Returns `(bedrockKbId, dataSourceId, indexArn, docPrefix)`

### `create_response()` Format

```python
{
    "statusCode": 200,
    "headers": {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS"
    },
    "body": json.dumps({...})
}
```

---

## KB Management: `kb_api.py`

**File**: `backend/kb_api.py`
**Lambda**: `bedrock-chat-kb-api`

### Routing Logic

The Lambda receives all requests under `/kbs/*` from API Gateway and routes internally based on `http.method` and `http.path`.

```python
method = event['requestContext']['http']['method']
route = event['requestContext']['http']['path']
path_params = event.get('pathParameters', {}) or {}
```

**Important**: DELETE route ordering is critical — the specific `DELETE /kbs/{id}/files/{file}` handler must come before the generic `DELETE /kbs/{id}` handler. An additional `'/files/' not in route` guard is applied to the KB-delete handler as defense in depth.

### Route Handlers

| Handler | Method + Route | Purpose |
|---------|---------------|---------|
| `handle_create_kb(user_id, body)` | `POST /kbs` | Rate-limit (max 10), generate kbId, create Bedrock KB + vector index + data source, store in DynamoDB |
| `handle_list_kbs(user_id, query_params)` | `GET /kbs` | Query DynamoDB by userId, refresh stuck statuses, update document counts |
| `handle_get_kb(user_id, kb_id)` | `GET /kbs/{id}` | GetItem from DynamoDB, refresh status + sync status + document count |
| `handle_delete_kb(user_id, kb_id)` | `DELETE /kbs/{id}` | Delete Bedrock KB + vector index, delete S3 files, delete DynamoDB record, cascade-delete agents |
| `handle_upload_file(user_id, kb_id, body)` | `POST /kbs/{id}/upload` | Generate presigned URLs — single file (`filename`+`contentType`) or batch (`files[]`) |
| `handle_list_files(user_id, kb_id)` | `GET /kbs/{id}/files` | List S3 files in KB prefix |
| `handle_delete_file(user_id, kb_id, file_key)` | `DELETE /kbs/{id}/files/{file}` | Delete single file from S3 (does NOT touch DynamoDB) |
| `handle_start_sync(user_id, kb_id)` | `POST /kbs/{id}/sync` | Start Bedrock ingestion job, update DynamoDB with IN_PROGRESS |
| `handle_get_sync_status(user_id, kb_id)` | `GET /kbs/{id}/sync` | Poll ingestion job, update DynamoDB on terminal status |
| `handle_get_stats(user_id, kb_id)` | `GET /kbs/{id}/stats` | List S3 files, fetch ingestion stats from Bedrock, compute indexedCount = scanned - failed |

### Notable Behaviors

- **indexedCount**: Fetched dynamically from last COMPLETE Bedrock ingestion job. No DynamoDB caching. Key names use `numberOfDocumentsScanned` / `numberOfDocumentsFailed` (capital `O` in `Of`).
- **Stuck status fix**: `handle_get_kb()` and `handle_list_kbs()` call `refresh_kb_sync_status()` to correct stuck `IN_PROGRESS` on page load.
- **Multi-file upload**: Backend accepts `files` array `[{filename, contentType}]` and returns `{presignedUrls: [{filename, presignedUrl, key}]}`.

---

## Chat Handler: `chat_handler.py`

**File**: `backend/chat_handler.py`
**Lambda**: `bedrock-chat-chat-handler`

### Route

`POST /chat`

### Handler: `handle_chat(user_id, body)`

**Request body**:
```json
{
    "kbId": "kb-abc123",
    "message": "What is Q3 revenue?",
    "agentId": "agent-xyz",       // optional
    "conversationId": "conv-def"  // optional (for continuing a conversation)
}
```

**Flow**:

1. Look up KB from DynamoDB — get `bedrockKbId`
2. If `agentId` provided, look up agent for `instructions` (custom system prompt)
3. Build `retrievalConfiguration` with:
   - `knowledgeBaseId`
   - `modelArn` (Claude Haiku 4.5 inference profile)
4. Build `generationConfiguration` with:
   - `promptTemplate.textPromptTemplate` — always set with `$search_results$` placeholder
   - Instructions to handle greetings/off-topic naturally
   - Agent instructions if provided
5. Call `bedrock_agent_runtime.retrieve_and_generate()` with type `KNOWLEDGE_BASE`
6. Parse response:
   - `output.text` — generated answer (may contain markdown)
   - `citations[]` — source references, deduplicated by `chunkId`
7. Persist conversation:
   - Append to S3 history file (`users/{userId}/conversations/{conversationId}.md`)
   - First message: create DynamoDB record with `title` = first 100 chars
   - Subsequent messages: increment `messageCount`

**Response**:
```json
{
    "response": "... generated answer with markdown ...",
    "sources": [{ "url": "s3://...", "chunkId": "..." }],
    "conversationId": "conv-abc123"
}
```

### Critical Rules

- `generationConfiguration.promptTemplate.textPromptTemplate` MUST contain `$search_results$` — this is the required placeholder for `KNOWLEDGE_BASE` type. Using `{context}` or `{input_text}` causes `ValidationException`.
- The model must support `RetrieveAndGenerate` natively (Claude 3/3.5/4+ does).
- `RetrieveAndGenerate` internally calls `bedrock:InvokeModel` on BOTH the inference profile ARN AND the underlying foundation model ARN — IAM policy must allow both.

---

## History Handler: `history_handler.py`

**File**: `backend/history_handler.py`
**Lambda**: `bedrock-chat-history-handler`

### Routes & Handlers

| Handler | Route | Purpose |
|---------|-------|---------|
| `handle_list_conversations(user_id, query_params)` | `GET /history` | Query DynamoDB by userId (descending), optional `?search=` filter on title/conversationId, limit 50 |
| `handle_get_conversation(user_id, conversation_id)` | `GET /history/{id}` | Get DynamoDB record, read full Markdown content from S3 |
| `handle_delete_conversation(user_id, conversation_id)` | `DELETE /history/{id}` | Delete S3 object + DynamoDB record |

### Notes

- Search is in-memory (no DynamoDB full-text search capability), filtering by `title` and `conversationId` fields
- Conversations are sorted by `updatedAt` descending
- Limit: 50 results per query
