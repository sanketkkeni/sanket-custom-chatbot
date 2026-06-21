# All Issues Faced & How They Were Fixed

## Issue 1: CORS Preflight Returns 401 (Failed to Fetch)

**Symptom**: Browser's OPTIONS preflight request returned `401 Unauthorized` instead of `200 OK`, causing `Failed to fetch` when creating a KB from the frontend.

**Root Cause**: API Gateway HTTP API (v2) integrations had `payload_format_version = "1.0"` (V1 REST API format), but the Lambda code expected the V2 format. In V1 format, `event.requestContext.http.method` doesn't exist — the method is at `event.httpMethod`. The `handle_options()` function checked the V2 path, never detected OPTIONS, and fell through to `get_user_from_event()` which returned 401 (no auth header on preflight).

**Fix**: Added `payload_format_version = "2.0"` to all three API Gateway integrations (`kb_api`, `chat_handler`, `history_handler`) in `infrastructure/api_gateway.tf`.

**Files changed**:
- `infrastructure/api_gateway.tf` — 3 lines added

---

## Issue 2: S3 Vectors `create_index` Parameter Error

**Symptom**: POST `/kbs` returned `500 Internal Server Error` with message: `Parameter validation failed: Unknown parameter in input: "vectorBucket", must be one of: vectorBucketName, vectorBucketArn...`

**Root Cause**: The boto3 `s3vectors.create_index()` API uses parameter name `vectorBucketName`, not `vectorBucket`. The code used the wrong parameter name.

**Fix**: Changed `vectorBucket` to `vectorBucketName` in both `create_knowledge_base()` and `delete_knowledge_base()` in `backend/utils.py`.

**Files changed**:
- `backend/utils.py` — 2 lines fixed

---

## Issue 3: DynamoDB Decimal Not JSON Serializable

**Symptom**: GET `/kbs` returned `500 Internal Server Error`. Lambda logs showed: `TypeError: Object of type Decimal is not JSON serializable`.

**Root Cause**: DynamoDB returns numeric values as `decimal.Decimal` objects. Python's `json.dumps()` cannot serialize Decimal by default. The `handle_list_kbs()` function passed DynamoDB items directly to `create_response()` which called `json.dumps()` on them.

**Fix**: Added a custom `DecimalEncoder` class in `backend/utils.py` that converts Decimal to int (if whole number) or float. Updated `create_response()` to use `cls=DecimalEncoder` when serializing.

**Files changed**:
- `backend/utils.py` — Added `DecimalEncoder` class, updated `create_response()` to use it

---

## Issue 4: Terraform Cloud Not Detecting Zip File Changes

**Symptom**: After fixing `utils.py` and rebuilding Lambda zips locally, `terraform apply` reported `No changes` — the zips weren't uploaded to Terraform Cloud.

**Root Cause**: Terraform Cloud tracks zip file hashes. Local zip rebuilds weren't being detected, possibly due to caching or hash comparison issues.

**Fix**: Used AWS CLI `update-function-code` to directly update Lambda functions instead of relying on Terraform for Lambda code updates.

**Commands used**:
```bash
aws lambda update-function-code --function-name bedrock-chat-kb-api --zip-file fileb://path/to/kb_api.zip
```

---

## Issue 9: Vercel Build Fails — Invalid `size` Prop on Native `<button>`

**Symptom**: Vercel deployment failed with: `Type error: Type '{ children: string; onClick: () => void; size: string; className: string; }' is not assignable to type 'DetailedHTMLProps...' Property 'size' does not exist on type '...'`.

**Root Cause**: `frontend/components/SyncStatus.tsx` line 36 had `size="sm"` on a native HTML `<button>` element. The `size` prop is not a valid HTML attribute — it only exists on component library buttons (e.g. Chakra, MUI). Next.js TypeScript compilation caught this as a type error.

**Fix**: Removed `size="sm"` from the `<button>` element. The `text-sm` Tailwind class already handles sizing.

**Files changed**:
- `frontend/components/SyncStatus.tsx` — 1 line changed

---
## Issue 5: Module Not Found Error on KB Manage Page

**Symptom**: Clicking "Manage" on a KB from the dashboard causes a `500 Build Error`: `Module not found: Can't resolve '../context/AuthContext'`. The page `/kb/{kbId}` crashes with a full-screen Next.js error overlay.

**Root Cause**: The file is at `pages/kb/[id].tsx` (two levels deep from project root), but relative imports use `../context/AuthContext` and `../lib/api`. From `pages/kb/`, `../` resolves to `pages/`, so it looks for `pages/context/AuthContext` — which doesn't exist (the actual path is `context/AuthContext`, one more level up). Same bug existed in `pages/chat/[kbId].tsx`.

**Fix**: Changed imports in both files:
- `../context/AuthContext` → `../../context/AuthContext`
- `../lib/api` → `../../lib/api`

**Files changed**:
- `frontend/pages/kb/[id].tsx` — 2 imports fixed
- `frontend/pages/chat/[kbId].tsx` — 2 imports fixed

---

## Issue 6: Upload Document Returns "Internal Server Error"

**Symptom**: Clicking to upload a document to a KB (POST `/kbs/{id}/upload`) returns `500 Internal Server Error`.

**Root Cause**: The `get_presigned_url()` function in `backend/utils.py` passed `ExpiresIn` inside the `Params` dict to `s3.generate_presigned_url()`. `Params` is forwarded to the underlying S3 API call (`put_object`), but `ExpiresIn` is not a parameter of `put_object` — it's a parameter of `generate_presigned_url()` itself. boto3 rejected `ExpiresIn` as an unknown parameter for `put_object`.

**Fix**: Moved `ExpiresIn` from the `Params` dict to the `generate_presigned_url()` call as a keyword argument:
```python
# Before
def get_presigned_url(bucket, key, content_type=None):
    params = {'Bucket': bucket, 'Key': key, 'ExpiresIn': 3600}
    ...
    return s3.generate_presigned_url('put_object', Params=params)

# After
def get_presigned_url(bucket, key, content_type=None):
    params = {'Bucket': bucket, 'Key': key}
    ...
    return s3.generate_presigned_url('put_object', Params=params, ExpiresIn=3600)
```

**Files changed**:
- `backend/utils.py` — 1 line fixed (moved `ExpiresIn` out of `Params`)

---

## Issue 7: KB Status Stuck on "CREATING" After Deploying Refresh Logic

**Symptom**: Dashboard and KB detail page showed `Status: CREATING` and `Documents: 0` even after documents were uploaded and synced. The refresh functions were deployed but had no effect.

**Root Cause**: The `refresh_kb_status()` and `refresh_document_count()` functions added to `backend/utils.py` used `datetime.utcnow().isoformat()` but `from datetime import datetime` was never added to the imports. Both functions silently failed (`except` logged a warning and returned `None`), leaving the DynamoDB status permanently at "CREATING".

CloudWatch logs showed: `Failed to refresh KB status: name 'datetime' is not defined`

**Fix**: Added `from datetime import datetime` to imports in `backend/utils.py`, rebuilt `kb_api.zip`, and redeployed via `aws lambda update-function-code`.

**Files changed**:
- `backend/utils.py` — 1 line added (import)

---

## Issue 8: Chat Returns AccessDenied — Missing `bedrock:Retrieve` Permission

**Symptom**: Clicking "Chat" on a KB throws `Error: Chat failed: An error occurred (AccessDeniedException) when calling the RetrieveAndGenerate operation... is not authorized to perform: bedrock:Retrieve`.

**Root Cause**: The Lambda IAM policy (`bedrock-chat-lambda-bedrock`) included `bedrock:RetrieveAndGenerate` but not `bedrock:Retrieve`. The `RetrieveAndGenerate` API internally calls `Retrieve`, which was denied.

**Fix**: Added `bedrock:Retrieve` to the IAM policy actions list. Updated both the Terraform source (`infrastructure/iam.tf`) and the live policy via `aws iam create-policy-version`.

**Files changed**:
- `infrastructure/iam.tf` — 1 line added (`bedrock:Retrieve`)
- Live IAM policy updated via AWS CLI

---


## Issue 10: Amazon Nova Micro Returns Misleading Errors with RetrieveAndGenerate

**Symptom**: Chat responses said *"The model cannot find sufficient information"* and *"Cannot read 'SherlockHolmesComplete.pdf' (this model does not support pdf input)"* even though the KB was synced successfully with documents.

**Root Cause**: `amazon.nova-micro-v1:0` does **not** support the `RetrieveAndGenerate` API. AWS docs confirm Nova Micro supports Bedrock Knowledge Bases only *"through tool use (function calling)"*, not via the direct `retrieve_and_generate` call. When called, it returned a confusing error message as response text instead of a proper API error.

**Fix**: Changed `chat_model_id` from `amazon.nova-micro-v1:0` to `anthropic.claude-3-haiku-20240307-v1:0` (Claude 3 Haiku fully supports `RetrieveAndGenerate`). Also increased `fixed_size_max_tokens` from 256 to 1500 so book chapters aren't split across too many tiny chunks.

**Files changed**:
- `infrastructure/variables.tf` — 2 lines changed (model ID + chunk size)
- `AGENTS.md` — 1 line updated (stack docs)

---

## Issue 11: KB Deletion Stuck — Data Source Vector Cleanup Conflict

**Symptom**: Deleting a KB from the UI returned `Delete unsuccessful — Unable to delete data from vector store for data source`. The KB and data source remained in `DELETE_UNSUCCESSFUL` status in the AWS console.

**Root Cause**: The `create_data_source()` call defaulted to `dataDeletionPolicy='DELETE'`. When the Lambda's `delete_data_source()` ran, Bedrock tried to clean up vectors from the S3 Vectors index. But we also independently delete the vector index ourselves. This ordering conflict caused data source deletion to fail, which cascaded to the KB deletion failing.

**Fix**: Added `dataDeletionPolicy='RETAIN'` to the `create_data_source()` call in `utils.py`. This tells Bedrock to skip vector cleanup during data source deletion — we handle vector index cleanup ourselves independently, which avoids the conflict.

Post-fix, had to manually clean up the stuck resources:
1. Updated the stuck data source's policy: `aws bedrock-agent update-data-source --data-deletion-policy RETAIN`
2. Deleted data source: `aws bedrock-agent delete-data-source`
3. Deleted KB: `aws bedrock-agent delete-knowledge-base`

**Files changed**:
- `backend/utils.py` — 1 line added (`dataDeletionPolicy='RETAIN'`)

---

## Issue 12: Anthropic FTU Form Not Submitted + Missing Marketplace Permissions

**Symptom**: Chat failed with `ValidationException: Model use case details have not been submitted for this account.` After submitting the FTU form, got `AccessDeniedException: Model access is denied due to IAM user or service role is not authorized to perform the required AWS Marketplace actions (aws-marketplace:ViewSubscriptions, aws-marketplace:Subscribe).`

**Root Cause**: Two separate prerequisites for using Anthropic Claude models on Bedrock:
1. The Anthropic First Time Use (FTU) form must be submitted once per account via `PutUseCaseForModelAccess` API — a global, one-time requirement not yet done for this account.
2. Even after FTU form submission, the first `InvokeModel` call auto-creates an AWS Marketplace SaaS agreement. This requires `aws-marketplace:Subscribe` and `aws-marketplace:ViewSubscriptions` on the caller's IAM role — the Lambda execution role didn't have these.

**Fix**:
1. Submitted FTU form via `aws bedrock put-use-case-for-model-access --region us-east-1` with form data: `companyName="Personal"`, `intendedUsers="0"` (internal), `industryOption="Technology"`, `useCases="Internal knowledge base chatbot for document Q&A using Anthropic Claude via Amazon Bedrock RetrieveAndGenerate"`.
2. Added `aws-marketplace:Subscribe` and `aws-marketplace:ViewSubscriptions` to the Lambda IAM policy (`bedrock-chat-lambda-bedrock`) in `infrastructure/iam.tf` and applied via Terraform Cloud.

**Files changed**:
- `infrastructure/iam.tf` — Added third statement block in `lambda_bedrock` policy with `aws-marketplace:Subscribe` and `aws-marketplace:ViewSubscriptions`

---

## Issue 13: Claude 3 Haiku Marked as Legacy — Must Switch to Inference Profile

**Symptom**: Chat failed with `ValidationException: Access denied. This Model is marked by provider as Legacy and you have not been actively using the model in the last 30 days. Please upgrade to an active model on Amazon Bedrock.`

After switching to the inference profile, three sub-issues appeared:
- Sub-issue A: `AccessDeniedException: Not authorized to call GetInferenceProfile`
- Sub-issue B: `AccessDeniedException: Not authorized to perform bedrock:InvokeModel on resource: arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0`
- Sub-issue C: `AccessDeniedException: Not authorized to perform bedrock:InvokeModel on resource: arn:aws:bedrock:us-east-2::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0` (inference profile can route to any US region)
- Sub-issue D: `AccessDeniedException: Not authorized to perform bedrock:InvokeModel on resource: arn:aws:bedrock:us-east-1:910972977862:inference-profile/us.anthropic.claude-haiku-4-5-20251001-v1:0` (RetrieveAndGenerate also calls InvokeModel on the inference profile ARN itself)

**Root Cause**: `anthropic.claude-3-haiku-20240307-v1:0` has been deprecated by Anthropic and marked as LEGACY. New accounts (or accounts that haven't used it in 30+ days) cannot access it. All dated Claude model IDs (`claude-3-*`, `claude-3-5-*`, `claude-sonnet-4-20250514-v1:0`) are LEGACY. Newer Claude models (4.5+) are only accessible via **inference profiles** (`us.anthropic.claude-haiku-4-5-*`) and support only `INFERENCE_PROFILE` inference type (not `ON_DEMAND`).

The `RetrieveAndGenerate` API's `modelArn` parameter accepts inference profile ARNs, so the initial fix is to use an inference profile instead of a foundation model ARN.

Sub-issue A: When `RetrieveAndGenerate` receives an inference profile ARN as `modelArn`, Bedrock internally calls `GetInferenceProfile` to resolve it — the Lambda role needs `bedrock:GetInferenceProfile` permission on the inference profile.

Sub-issue B & C: The inference profile `us.anthropic.claude-haiku-4-5-20251001-v1:0` is a cross-region profile covering us-east-1, us-east-2, and us-west-2. Bedrock load-balances across these regions and can pick any one. The IAM policy must allow `bedrock:InvokeModel` on the underlying foundation model ARN in **all three regions** — listing only us-east-1 failed when routing hit us-east-2.

Sub-issue D: `RetrieveAndGenerate` internally calls `bedrock:InvokeModel` on **both** the inference profile ARN AND the underlying foundation model ARN. The IAM policy must list BOTH in the `InvokeModel` resource list — the inference profile ARN (`local.chat_model_arn`) plus the underlying foundation model ARNs in all 3 US regions.

**Fix**:
1. Changed `chat_model_id` from `anthropic.claude-3-haiku-20240307-v1:0` → `us.anthropic.claude-haiku-4-5-20251001-v1:0` in `infrastructure/variables.tf`
2. Changed `chat_model_arn` construction in `infrastructure/main.tf` from foundation model ARN format (`arn:aws:bedrock:{region}::foundation-model/{id}`) to inference profile ARN format (`arn:aws:bedrock:{region}:{account}:inference-profile/{id}`)
3. Applied via Terraform Cloud — updated IAM policy and Lambda environment variables
4. Added `bedrock:GetInferenceProfile` to the first IAM statement (Resource = "*") to resolve the inference profile
5. Added `bedrock:GetInferenceProfile` to the first IAM statement (Resource = "*") — fixes Sub-issue A
6. Added `arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0` to the `bedrock:InvokeModel` resource list — partial fix for Sub-issue B (failed when routing hit us-east-2)
7. Added all 3 US region foundation model ARNs (`us-east-1`, `us-east-2`, `us-west-2`) to the `InvokeModel` resource list — fixes Sub-issues B & C
8. Restored `local.chat_model_arn` (inference profile ARN) to the `InvokeModel` resource list (had been accidentally removed) — fixes Sub-issue D

**Files changed**:
- `infrastructure/variables.tf` — Changed `chat_model_id` default to `us.anthropic.claude-haiku-4-5-20251001-v1:0`
- `infrastructure/main.tf` — Changed `chat_model_arn` to inference profile ARN format
- `infrastructure/iam.tf` — Added `bedrock:GetInferenceProfile` to first statement, added inference profile ARN + 3 region foundation model ARNs to `InvokeModel` resource list
- `AGENTS.md` — Updated stack docs

---

---

## Issue 14: Greetings Fail With "Sorry, I am unable to assist you with this request"

**Symptom**: Sending a greeting ("hi", "hello", "how are you?") returns `Sorry, I am unable to assist you with this request` instead of a natural response.

**Root Cause**: The `RetrieveAndGenerate` API has a default system prompt that strictly instructs the model to only answer from the provided context. When no knowledge base context is returned (as expected for greetings), the model follows the default prompt and refuses to respond. The `chat_handler.py` code only supplied a custom `generationConfiguration.promptTemplate.textPromptTemplate` when agent `instructions` were provided — without it, Bedrock's default refusal prompt kicked in.

**Fix**: Two-part fix:

1. `generationConfiguration` is now always set in `query_config` — regardless of whether agent `instructions` exist. The prompt template includes instructions to respond naturally to greetings and small talk, use context when relevant, and let the user know the assistant can help with their documents when context is empty.

2. The first attempt used `{context}` as the placeholder for retrieved search results, but the `textPromptTemplate` requires the `$search_results$` placeholder — the API throws `ValidationException` without it. Changed `{context}` → `$search_results$` and removed `{input_text}` (user input is handled automatically by the API).

**Files changed**:
- `backend/chat_handler.py` — Restructured the prompt building logic: always sets `generationConfiguration`, uses `$search_results$` placeholder

---

---
## Issue 15: File Upload Only Supports Single File at a Time

**Symptom**: The upload component and KB detail page only allowed selecting and uploading one file at a time. Users had to upload files individually, which was tedious for batch document ingestion.

**Root Cause**: Two issues:
1. **Backend** (`backend/kb_api.py`): The `handle_upload_file()` function only accepted a single `filename` + `contentType` pair and returned a single presigned URL per request. There was no support for batch presigned URL generation.
2. **Frontend** (`frontend/components/FileUpload.tsx` and `frontend/pages/kb/[id].tsx`): The `<input type="file">` elements lacked the `multiple` attribute. Both change handlers only processed `e.target.files[0]` (the first file), ignoring any additional files. Each upload required a separate API call to the backend.

**Fix**: Three-part fix:

1. **Backend** (`backend/kb_api.py`): Updated `handle_upload_file()` to support both the original single-file format (backward compatible) and a new batch format accepting a `files` array. Each entry in the array has `filename` and `contentType`. The function generates presigned URLs for all files and returns them in a `presignedUrls` array.

```python
# New batch format accepted:
# POST /kbs/{id}/upload { "files": [{ "filename": "a.pdf", "contentType": "application/pdf" }, ...] }
# Returns: { "presignedUrls": [{ "filename": "a.pdf", "presignedUrl": "...", "key": "..." }, ...] }
```

2. **Frontend API** (`frontend/lib/api.ts`): Added `getUploadUrls(kbId, files[])` function that sends the batch request to the backend.

3. **Frontend components** (`FileUpload.tsx` and `kb/[id].tsx`): Added `multiple` attribute to file inputs. Changed change handlers to iterate over all selected files. Uses `Promise.allSettled` (in `FileUpload.tsx`) for parallel uploads with per-file error tracking. Shows individual success/error messages per file.

**Files changed**:
- `backend/kb_api.py` — `handle_upload_file()` rewritten to support batch `files` array
- `frontend/lib/api.ts` — Added `getUploadUrls()` batch function
- `frontend/components/FileUpload.tsx` — Added `multiple`, parallel upload with `Promise.allSettled`, per-file error display
- `frontend/pages/kb/[id].tsx` — Added `multiple`, batch upload via `getUploadUrls`, `Array.from()` for file list

---

---

## Issue 16: Indexed Count Shows 0 After Successful Sync

**Symptom**: KB detail page shows "Last sync: Completed" and "Files: 26", but "Indexed Documents" shows 0 even though Bedrock successfully indexed documents.

**Root Cause**: Three bugs found and fixed iteratively:

1. **Bedrock statistics key name mismatch**: The `get_ingestion_status()` function in `backend/utils.py` accessed Bedrock ingestion job statistics with wrong key names. Bedrock returns `numberOfDocumentsScanned`, `numberOfNewDocumentsIndexed`, etc. (camelCase with capital **O** in "Of"), but the code used `numberofDocumentsScanned`, `numberofNewDocumentsIndexed` (lowercase **o**). Since the keys didn't match, `.get()` always returned 0.

2. **Wrong metric for re-syncs**: Even after fixing the key names, `numberOfNewDocumentsIndexed` was 0 on re-syncs because all documents were already indexed in the first sync. Bedrock only counts documents as "new" if they've never been indexed before — on re-syncs, previously indexed documents don't appear here. The correct metric for total successfully indexed documents is `numberOfDocumentsScanned - numberOfDocumentsFailed`.

3. **Cached state approach was fragile**: Initially attempted to store `indexedCount`/`failedCount` in DynamoDB with `lastIndexedJobId` guards to prevent double-counting. This approach had race conditions (concurrent Lambda invocations on page load) and stale data issues (pre-existing KBs created before the feature was deployed had no tracking fields).

**Fix**: Three fixes in sequence:

1. **Fixed Bedrock statistics key names** in `get_ingestion_status()`: Changed `numberof` → `numberOf` (capital O) in all `.get()` calls.

2. **Scrapped DynamoDB caching, switched to dynamic fetch**: Removed all `indexedCount`/`failedCount`/`lastIndexedJobId` tracking from the codebase. Instead, `handle_get_stats()` now directly calls `get_ingestion_status()` on every page load when `lastSyncStatus == 'COMPLETE'` and computes:
   - `indexedCount = numberOfDocumentsScanned - numberOfDocumentsFailed`
   - `failedCount = numberOfDocumentsFailed`
   
   This is stateless, always correct, and handles pre-existing KBs without any migration.

3. **Added "Failed Documents" stats card**: Frontend KB detail page got a 4th column showing failed document count (highlighted in red when > 0).

**Files changed**:
- `backend/utils.py`:
  - `get_ingestion_status()` — Fixed Bedrock statistics key names: `numberof` → `numberOf`
  - `refresh_kb_sync_status()` — Reverted to simple IN_PROGRESS fix (removed all indexedCount/failedCount/lastIndexedJobId logic)
- `backend/kb_api.py`:
  - `handle_create_kb()` — Removed `indexedCount`, `failedCount`, `lastIndexedJobId` fields (never needed)
  - `handle_get_sync_status()` — Reverted to simple status update (removed indexedCount increment logic)
  - `handle_get_kb()` — Removed stale indexedCount/failedCount refresh block
  - `handle_list_kbs()` — Removed stale indexedCount/failedCount refresh block
  - `handle_get_stats()` — Complete rewrite: dynamically fetches ingestion stats from Bedrock API, computes indexedCount as `scanned - failed`, returns failedCount
- `frontend/pages/kb/[id].tsx` — Changed stats grid from `grid-cols-3` to `grid-cols-4`, added "Failed Documents" card (red when > 0)

---

## Issue 17: Switch to Foundation Model Parsing with Claude Haiku 4.5 and Semantic Chunking

**Symptom**: Documents were parsed using Bedrock's default (built-in) parser and chunked with FIXED_SIZE strategy (512 tokens, 10% overlap). Wanted to use Claude Haiku 4.5 as the document parser and switch to SEMANTIC chunking for better contextual chunk boundaries.

**Root Cause**: Two configuration gaps:
1. **Parsing strategy**: The `create_data_source()` call in `backend/utils.py` never set `parsingConfiguration`, so Bedrock used its default parser (not a foundation model). The correct strategy name is `BEDROCK_FOUNDATION_MODEL` (not `FOUNDATION_MODEL`).
2. **Chunking strategy**: Only `FIXED_SIZE` chunking configuration was implemented. No support for `SEMANTIC` chunking with its parameters (`breakpointPercentileThreshold`, `bufferSize`, `maxTokens`).

**Fix**: Three-part fix across backend, infrastructure, and AWS resources:

1. **Backend** (`backend/utils.py`):
   - Added `PARSING_MODEL_ARN`, `SEMANTIC_CHUNKING_BREAKPOINT_PCT`, `SEMANTIC_CHUNKING_BUFFER_SIZE`, `SEMANTIC_CHUNKING_MAX_TOKENS` env vars
   - Updated `create_knowledge_base()` to build conditional `chunkingConfiguration` based on strategy (`SEMANTIC` uses `semanticChunkingConfiguration`, `FIXED_SIZE` uses `fixedSizeChunkingConfiguration`)
   - Added `parsingConfiguration` with `BEDROCK_FOUNDATION_MODEL` strategy and `modelArn` pointing to the Claude Haiku 4.5 inference profile

2. **Infrastructure**:
   - `infrastructure/variables.tf`: Changed `chunking_strategy` default to `"SEMANTIC"`, added `parsing_model_id`, `semantic_chunking_breakpoint_percentile_threshold`, `semantic_chunking_buffer_size`, `semantic_chunking_max_tokens` variables
   - `infrastructure/main.tf`: Added `parsing_model_arn` local
   - `infrastructure/lambda.tf`: Added env vars for parsing model and semantic chunking
   - `infrastructure/iam.tf`: Added `bedrock:GetInferenceProfile` and `bedrock:InvokeModel` (on inference profile ARN + 3 US region foundation model ARNs) to the Bedrock execution role's policy

3. **Existing KB update** (manual via AWS CLI):
   - Deleted the old data source (config is immutable after creation)
   - Created a new data source with `parsingConfiguration` (`BEDROCK_FOUNDATION_MODEL`) + `chunkingConfiguration` (`SEMANTIC`, 95/0/512)
   - Updated DynamoDB with new `dataSourceId`
   - Started a new ingestion job to re-process all 26 documents with the new parser and chunking

**Files changed**:
- `backend/utils.py`:
  - Added env var reads for `PARSING_MODEL_ARN`, `SEMANTIC_CHUNKING_BREAKPOINT_PCT`, `SEMANTIC_CHUNKING_BUFFER_SIZE`, `SEMANTIC_CHUNKING_MAX_TOKENS`
  - Updated `create_knowledge_base()` to build conditional chunking config and include `parsingConfiguration`
- `infrastructure/variables.tf` — Changed chunking default to SEMANTIC, added 4 new variables
- `infrastructure/main.tf` — Added `parsing_model_arn` local
- `infrastructure/lambda.tf` — Added 5 new environment variables
- `infrastructure/iam.tf` — Added `bedrock:GetInferenceProfile` and bedrock foundation model ARNs to execution role
- `AGENTS.md` — Updated stack description and added configuration section

## Issue 18: Delete File Actually Deletes Entire KB

**Symptom**: Clicking "delete file" on a PNG in the Manage KB section removed the entire KB from the UI (DynamoDB record + S3 files deleted), but left the Bedrock KB orphaned.

**Root Cause**: Route ordering bug in `backend/kb_api.py`. The generic `DELETE /kbs/{id}` handler was defined BEFORE the specific `DELETE /kbs/{id}/files/{file}` handler. API Gateway routes both requests to the same Lambda (same `/kbs` route), so the Lambda routes internally. The generic handler used `route.startswith('/kbs/')`, which matches `/kbs/{id}/files/{file}` — it caught the file-delete request and called `handle_delete_kb()` instead.

```python
# BAD ORDER: generic catch-all matched first
if method == 'DELETE' and route.startswith('/kbs/'):          # matches EVERYTHING under /kbs/
    return handle_delete_kb(user_id, path_params['id'])       # oops, deleted whole KB

if method == 'DELETE' and '/files/' in route:                  # never reached
    return handle_delete_file(user_id, kb_id, file_key)
```

**Fix**: Moved the specific file-delete handler BEFORE the generic KB-delete handler. The specific route is now checked first; if it doesn't match, execution falls through to the generic KB delete.

```python
# GOOD ORDER: specific route checked first
if method == 'DELETE' and '/files/' in route:                  # checked first
    return handle_delete_file(user_id, kb_id, file_key)

if method == 'DELETE' and route.startswith('/kbs/'):           # only if /files/ not in route
    return handle_delete_kb(user_id, path_params['id'])
```

**Sub-issue A**: The initial fix (reordering handlers) was deployed but didn't take effect. The root cause was a **stale zip file path** — `build.ps1` outputs zips to `backend/`, but `update-function-code` was reading from `infrastructure/` (an old pre-existing zip). The `CodeSha256` never changed and the old code kept running.

**Sub-issue B (defense in depth)**: Even with correct routing, a `'/files/' not in route` guard was added to the KB-delete handler as a safety net:

```python
# Extra guard ensures KB-delete can never catch file-delete
if method == 'DELETE' and route.startswith('/kbs/') and '/files/' not in route:
    return handle_delete_kb(user_id, path_params['id'])
```

**Files changed**:
- `backend/kb_api.py` — Reordered DELETE handlers (file-delete above KB-delete); added `'/files/' not in route` guard on KB-delete; added `routeKey` and `path_params` to logging for debugging.
- `backend/build.ps1` — Changed output path to `..\infrastructure` so zips go directly to the infrastructure folder, preventing stale-zip deployment issues.

---

## Issue 19: JPG/PNG Files Rejected — "File Format Not Supported" in Bedrock KB

**Symptom**: Uploading a JPG or PNG image to a KB and syncing resulted in `"Ignored 1 files as their file format was not supported"`. The ingestion job completed but zero documents were indexed.

**Root Cause**: Bedrock KB with a foundation model parser (Sonnet 4.6) requires a **multimodal storage destination** S3 bucket to accept image files (JPG/PNG). Without `supplementalDataStorageConfiguration` in the KB, Bedrock falls back to the default (text-only) parser, which rejects non-text formats. The parser model and the KB storage configuration are separate — you can have Sonnet 4.6 configured as the parser but if there's no multimodal storage bucket, the KB refuses image files.

Also: the chat model was updated from Claude Haiku 4.5 to Sonnet 4.6 for better reasoning at query time. Stale Claude Haiku 4.5 foundation model ARNs were removed from the Lambda IAM policy.

**Fix**: Five changes:
1. **New S3 bucket** (`infrastructure/s3.tf`): Added `aws_s3_bucket.multimodal_storage` (`bedrock-chat-storage-{random}`) with versioning and SSE enabled — acts as the multimodal storage destination for Bedrock KB.
2. **Bedrock execution role S3 policy** (`infrastructure/iam.tf`): Added `bedrock_s3_multimodal_storage` policy granting `s3:ListBucket`/`s3:GetObject`/`s3:PutObject` on the new bucket — Bedrock needs this to store/retrieve parsed multimodal content.
3. **Lambda env var** (`infrastructure/lambda.tf`): Added `MULTIMODAL_STORAGE_BUCKET` to the `kb_api` Lambda environment.
4. **Backend logic** (`backend/utils.py`): Reads `MULTIMODAL_STORAGE_BUCKET` env var; conditionally adds `supplementalDataStorageConfiguration.storageLocations[{s3://bucket/kb/{name}/}]` to the `create_knowledge_base` call when the bucket is set.
5. **Chat model upgrade** (`infrastructure/variables.tf`): Changed `chat_model_id` default from `us.anthropic.claude-haiku-4-5-20251001-v1:0` to `us.anthropic.claude-sonnet-4-6`; removed stale Haiku ARNs from IAM policy.

**Language support**: Hindi, Marathi, and English text extraction from images is handled by the Sonnet 4.6 parser (already configured as `BEDROCK_FOUNDATION_MODEL` with `parsingModelArn`). The multimodal storage bucket enables this parser to receive JPG/PNG input instead of falling back to the default text-only parser.

**Files changed**:
- `infrastructure/s3.tf` — Added `multimodal_storage` S3 bucket + versioning + encryption
- `infrastructure/iam.tf` — Added `bedrock_s3_multimodal_storage` policy on Bedrock execution role; removed stale Haiku ARNs from Lambda bedrock policy
- `infrastructure/lambda.tf` — Added `MULTIMODAL_STORAGE_BUCKET` env var to `kb_api`
- `infrastructure/variables.tf` — Changed `chat_model_id` default to Sonnet 4.6
- `infrastructure/outputs.tf` — Added `multimodal_storage_bucket` output
- `backend/utils.py` — Added `MULTIMODAL_STORAGE_BUCKET` env var; added `supplementalDataStorageConfiguration` to `create_knowledge_base`

---

## Issue 20: JPG/PNG Files Rejected as "File Format Not Supported"

**Symptom**: After JPG upload to KB data source ingestion job returns `COMPLETE` but statistics show `numberOfDocumentsFailed: 1` with reason: `"Ignored 1 files as their file format was not supported."`

**Root Cause**: The Foundation Model parser's `bedrockFoundationModelConfiguration` was missing the `parsingModality` field. When not set, it defaults to text-only parsing, which rejects standalone image files (JPG, PNG, etc.) even though the KB has multimodal storage (`supplementalDataStorageConfiguration`) configured.

**Fix**: Added `'parsingModality': 'MULTIMODAL'` to the `bedrockFoundationModelConfiguration` dict in `create_data_source()` call. This tells the Foundation Model parser to enable parsing of multimodal data including both text and images.

**Important detail**: The `parsingConfiguration` is immutable after data source creation — you must delete and recreate the data source to change it. After adding `parsingModality: MULTIMODAL`:

New data source `H1W8JIVVV3` on KB `YY9Z6WIFHQ` completed successfully:
- Scanned: 1 (test_account.jpg)
- New documents indexed: 1
- Failed: 0

Verified with `RetrieveAndGenerate` query:
- "What is the account balance and customer name?" → "Rajesh Sharma, Rs 1,25,000"
- Hindi content "Namaste, aapaka swagat hai" was also extracted and retrievable

**Files changed**:
- `backend/utils.py` — Added `'parsingModality': 'MULTIMODAL'` to `bedrockFoundationModelConfiguration` (line 249)

---

## Issue 21: Oversized JPG/PNG Files Rejected by Bedrock KB (3.75 MB Limit)

**Symptom**: Uploading large JPG files (>3.75 MB) to a KB resulted in ingestion failure with `"Unknown failure code: UNKNOWN [Files: null]"`. Files between 3.75 MB and 7 MB were silently rejected during sync.

**Root Cause**: Bedrock KB has a hard 3.75 MB file size limit for JPG/PNG images when using the Foundation Model parser with `parsingModality: MULTIMODAL`. Files exceeding this limit fail silently during ingestion. No compression was applied — users could upload images of any size but the KB would reject oversized ones.

**Fix**: Implemented automated server-side image compression via an S3-triggered Lambda (`bedrock-chat-image-processor`):

1. **New Lambda** (`backend/image_processor.py`): Triggered by S3 `s3:ObjectCreated:*` events on `.jpg`, `.jpeg`, `.png` files. When an image exceeds 3.5 MB, it progressively reduces JPEG quality (85→20), then resizes dimensions (80% steps) until under 3.5 MB. Sets `bedrock_processed=true` tag to prevent re-processing loops.

2. **Pillow dependency**: Created Lambda layer with Pillow for Python 3.13. Layer built via `pip install --platform manylinux2014_x86_64 --python-version 313 --only-binary=:all:`.

3. **Infrastructure**: Added IAM role (`image_processor_role`) with `AWSLambdaBasicExecutionRole` + S3 read/write/tagging permissions. Added S3 bucket notification filtering `.jpg`, `.jpeg`, `.png` suffixes. Added Lambda permission allowing S3 invocation.

4. **Existing files**: After deployment, existing large files were handled by copying them in-place (`aws s3 cp`) to trigger S3 events, which the Lambda then compressed.

**Files changed**:
- `backend/image_processor.py` — New Lambda for S3-triggered image compression
- `infrastructure/lambda.tf` — Added `aws_lambda_layer_version.pillow`, `aws_lambda_function.image_processor`, `aws_lambda_permission.image_processor_s3`
- `infrastructure/iam.tf` — Added `aws_iam_role.image_processor_role` + inline S3 policy
- `infrastructure/s3.tf` — Added `aws_s3_bucket_notification.documents_image_processor`
- `backend/build.ps1` — Added Pillow layer build + `image_processor.zip` creation

---

## Issue 22: Pillow Lambda Layer Import Error — "No module named 'PIL'"

**Symptom**: The `bedrock-chat-image-processor` Lambda failed at runtime with `Runtime.ImportModuleError: Unable to import module 'image_processor': No module named 'PIL'`. The Pillow layer (`bedrock-chat-pillow:1` at 8.5 MB) was attached to the function but Python couldn't find the PIL module.

**Root Cause**: The `build.ps1` script used `Compress-Archive -Path python\*` which zipped the **contents** of the `python/` directory, not the directory itself. The resulting zip had entries like `PIL/AvifImagePlugin.py` at the root level instead of `python/PIL/AvifImagePlugin.py`. Lambda layers require the `python/` prefix directory for Python runtime to find packages via `sys.path`.

```powershell
# BROKEN: zips contents of python/ directly
Compress-Archive -Path (Join-Path $LAYER_DIR "python\*") -DestinationPath pillow-layer.zip

# FIXED: zips the python/ directory itself, preserving the prefix
Compress-Archive -Path (Join-Path $LAYER_DIR "python") -DestinationPath pillow-layer.zip
```

**Fix**: Changed `python\*` to `python` in the `Compress-Archive` call in `backend/build.ps1` line 31. Rebuilt all zips, ran `terraform apply` to publish a new layer version (v2) and update the Lambda function's layer reference.

**Verification**: 
- Layer v2 zip entries now correctly start with `python/PIL/...`
- Uploaded 14.84 MB test image → Lambda compressed to 3.35 MB ✓
- Existing 7.3 MB and 4.66 MB files compressed to 3.37 MB and 2.46 MB ✓
- Both KBs re-synced with 0 failures ✓
- RAG queries work against compressed images ✓

**Files changed**:
- `backend/build.ps1` — Changed `python\*` to `python` in `Compress-Archive` on line 31
