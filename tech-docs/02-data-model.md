# Data Model

## DynamoDB Tables

### `bedrock-chat-kbs`

Stores metadata for each Knowledge Base created by a user.

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `userId` | String | HASH | Cognito username (sub or email) |
| `kbId` | String | SORT | `kb-{uuid4 hex[:12]}` |
| `name` | String | | User-provided display name |
| `status` | String | | `CREATING`, `ACTIVE`, `FAILED`, `DELETING` |
| `bedrockKbId` | String | | Bedrock-assigned Knowledge Base ID |
| `dataSourceId` | String | | Bedrock data source ID |
| `s3BucketName` | String | | Document S3 bucket name |
| `s3Prefix` | String | | `users/{userId}/kbs/{kbId}/` |
| `vectorIndexArn` | String | | `arn:aws:s3vectors:.../index/idx-{kbId}` |
| `documentCount` | Number | | Count of files in S3 prefix |
| `lastSyncStatus` | String | | `NONE`, `IN_PROGRESS`, `COMPLETE`, `FAILED` |
| `lastSyncJobId` | String | | Bedrock ingestion job ID |
| `lastSyncError` | String | | Error message from failed sync |
| `createdAt` | String | | ISO 8601 timestamp |
| `updatedAt` | String | | ISO 8601 timestamp |

**GSI**: `bedrockKbId-index` (HASH: `bedrockKbId`, projection: ALL)

### `bedrock-chat-agents`

Stores agent configurations (not fully utilized in current version).

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `userId` | String | HASH | Cognito username |
| `agentId` | String | SORT | `agent-{uuid4 hex[:12]}` |
| `kbId` | String | | Associated KB ID |
| `name` | String | | Agent display name |
| `modelId` | String | | Bedrock model ARN |
| `instructions` | String | | Custom system prompt for RAG |
| `createdAt` | String | | ISO 8601 timestamp |
| `updatedAt` | String | | ISO 8601 timestamp |

**GSI**: `kbId-index` (HASH: `kbId`, projection: ALL)

### `bedrock-chat-conversations`

Stores metadata for each chat conversation.

| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `userId` | String | HASH | Cognito username |
| `conversationId` | String | SORT | `conv-{uuid4 hex[:12]}` |
| `agentId` | String | | Agent ID (if agent was used) |
| `kbId` | String | | Associated KB ID |
| `title` | String | | First 100 chars of first user message |
| `s3Key` | String | | `users/{userId}/conversations/{conversationId}.md` |
| `messageCount` | Number | | Total messages in conversation |
| `createdAt` | String | | ISO 8601 timestamp |
| `updatedAt` | String | | ISO 8601 timestamp |

**GSIs**: `agentId-index` (HASH: `agentId`), `kbId-index` (HASH: `kbId`)

## S3 Structures

### Documents Bucket

```
bedrock-chat-docs-{random8}/
  users/{userId}/kbs/{kbId}/
    {filename1}.pdf
    {filename2}.txt
    ...
```

**Supported file types**: PDF, TXT, MD, HTML, CSV, DOC, DOCX, XLS, XLSX

**Image files (PNG, JPEG, GIF) are NOT supported** — even with `BEDROCK_FOUNDATION_MODEL` parsing. The file format check happens before the parser is invoked. To ingest image content, embed them inside a PDF which the foundation model parser can extract text from.

**Security**: Versioning enabled, AES-256 encryption, CORS enabled for all origins.

### History Bucket

```
bedrock-history-{random8}/
  users/{userId}/conversations/{conversationId}.md
```

**Conversation markdown format**:

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
- s3://bucket/users/uid/kbs/kb-id/q3-report.pdf
```

### S3 Vectors Bucket

```
bedrock-chat-vectors/
  idx-{kbId}/       (S3 Vector index, not a real folder)
```

- **Data type**: `float32`
- **Dimension**: 1024
- **Distance metric**: `euclidean`
- **Non-filterable metadata keys**: `['AMAZON_BEDROCK_TEXT', 'AMAZON_BEDROCK_METADATA']`
  - Filterable metadata is capped at 2048 bytes per vector; these text-heavy fields must be excluded

## Bedrock Knowledge Base Configuration

### Knowledge Base

- **Type**: `VECTOR`
- **Embedding model**: `amazon.titan-embed-text-v2:0`
- **Vector store**: S3 Vectors

### Data Source

- **Chunking strategy**: `SEMANTIC` (default)
  - `breakpointPercentileThreshold`: 95
  - `bufferSize`: 0
  - `maxTokens`: 512
- **Alternate chunking**: `FIXED_SIZE`
  - `maxTokens`: 512
  - `overlapPercentage`: 10
- **Parsing strategy**: `BEDROCK_FOUNDATION_MODEL`
  - Model: `us.anthropic.claude-haiku-4-5-20251001-v1:0` inference profile
- **Data deletion policy**: `RETAIN` (documents remain in S3 after KB delete)

**Both parsing and chunking configurations are immutable after data source creation** — you must delete and recreate the data source to change either.
