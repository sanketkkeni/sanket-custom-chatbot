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

**Fix**: `generationConfiguration` is now always set in `query_config` — regardless of whether agent `instructions` exist. The prompt template includes instructions to respond naturally to greetings and small talk, use context when relevant, and let the user know the assistant can help with their documents when context is empty.

**Files changed**:
- `backend/chat_handler.py` — Restructured the prompt building logic: always sets `generationConfiguration`, layer agent instructions on top when provided

---

## Summary of Root Causes

| Issue | Category | Root Cause |
|-------|----------|------------|
| CORS 401 | API Gateway config | `payload_format_version` defaulted to `1.0` but code expects `2.0` |
| S3 Vectors param | boto3 API | Wrong parameter name `vectorBucket` instead of `vectorBucketName` |
| Decimal serialization | DynamoDB + JSON | DynamoDB returns `Decimal` objects, `json.dumps` can't serialize them |
| Zip not deployed | Terraform Cloud | Terraform didn't detect local zip changes |
| Module not found in KB/chat pages | Frontend imports | Wrong relative import depth — `../` only goes up one level but files are two levels deep |
| Upload presigned URL error | Backend Lambda | `ExpiresIn` passed inside `Params` to `generate_presigned_url` but it's a kwarg of the function, not an S3 API param |
| KB status stuck on CREATING | Backend Lambda | `datetime` not imported in `utils.py` — refresh functions silently failed |
| Chat AccessDenied on Retrieve | IAM policy | `bedrock:Retrieve` missing from Lambda IAM policy — `RetrieveAndGenerate` requires it internally |
| Vercel build fails on size prop | Frontend build | `size="sm"` used on native `<button>` — not a valid HTML attribute, TypeScript rejects it |
| Nova Micro not supported for RetrieveAndGenerate | Model config | `amazon.nova-micro-v1:0` doesn't support `RetrieveAndGenerate` API — returned misleading error text |
| KB deletion stuck on vector cleanup | Backend Lambda + AWS API | `dataDeletionPolicy='DELETE'` caused vector cleanup conflict — changed to `RETAIN` |
| Chat fails after model switch | Anthropic FTU + IAM | FTU form not submitted for this account; Lambda IAM role missing `aws-marketplace:Subscribe` and `aws-marketplace:ViewSubscriptions` |
| Claude 3 Haiku legacy error | Model deprecation + inference profile | `anthropic.claude-3-haiku-20240307-v1:0` marked LEGACY; switched to inference profile `us.anthropic.claude-haiku-4-5-20251001-v1:0`; needed `bedrock:GetInferenceProfile` + `InvokeModel` on both inference profile ARN AND underlying foundation model ARNs in all 3 US regions (us-east-1, us-east-2, us-west-2) |
