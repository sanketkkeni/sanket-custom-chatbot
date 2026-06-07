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

**Symptom**: Dashboard and KB detail page showed `Status: CREATING` and `Documents: 0` even after documents were uploaded and synced. The refresh functions were deployed but had no effect.

**Root Cause**: The `refresh_kb_status()` and `refresh_document_count()` functions added to `backend/utils.py` used `datetime.utcnow().isoformat()` but `from datetime import datetime` was never added to the imports. Both functions silently failed (`except` logged a warning and returned `None`), leaving the DynamoDB status permanently at "CREATING".

CloudWatch logs showed: `Failed to refresh KB status: name 'datetime' is not defined`

**Fix**: Added `from datetime import datetime` to imports in `backend/utils.py`, rebuilt `kb_api.zip`, and redeployed via `aws lambda update-function-code`.

**Files changed**:
- `backend/utils.py` — 1 line added (import)

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
