import os
import json
import base64
import decimal
from datetime import datetime
import boto3
import time
import uuid
import logging
from boto3.dynamodb.conditions import Key


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, decimal.Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super().default(obj)

logger = logging.getLogger()
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO'))

dynamodb = boto3.resource('dynamodb')
s3 = boto3.client('s3')
bedrock = boto3.client('bedrock')
bedrock_agent = boto3.client('bedrock-agent')
bedrock_agent_runtime = boto3.client('bedrock-agent-runtime')
s3vectors = boto3.client('s3vectors')
sts = boto3.client('sts')

# Environment variables
KB_TABLE_NAME = os.environ.get('KB_TABLE_NAME')
AGENTS_TABLE_NAME = os.environ.get('AGENTS_TABLE_NAME')
CONVERSATIONS_TABLE_NAME = os.environ.get('CONVERSATIONS_TABLE_NAME')
DOCUMENTS_BUCKET = os.environ.get('DOCUMENTS_BUCKET')
HISTORY_BUCKET = os.environ.get('HISTORY_BUCKET')
VECTOR_BUCKET_NAME = os.environ.get('VECTOR_BUCKET_NAME')
BEDROCK_ROLE_ARN = os.environ.get('BEDROCK_ROLE_ARN')
EMBEDDING_MODEL_ARN = os.environ.get('EMBEDDING_MODEL_ARN')
CHAT_MODEL_ARN = os.environ.get('CHAT_MODEL_ARN')
VECTOR_DIMENSION = int(os.environ.get('VECTOR_DIMENSION', 1024))
CHUNKING_STRATEGY = os.environ.get('CHUNKING_STRATEGY', 'FIXED_SIZE')
FIXED_SIZE_MAX_TOKENS = int(os.environ.get('FIXED_SIZE_MAX_TOKENS', 256))
FIXED_SIZE_OVERLAP_PCT = int(os.environ.get('FIXED_SIZE_OVERLAP_PCT', 10))
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')

kbs_table = dynamodb.Table(KB_TABLE_NAME) if KB_TABLE_NAME else None
agents_table = dynamodb.Table(AGENTS_TABLE_NAME) if AGENTS_TABLE_NAME else None
conversations_table = dynamodb.Table(CONVERSATIONS_TABLE_NAME) if CONVERSATIONS_TABLE_NAME else None

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS'
}

CORS_MULTI_HEADERS = {
    'Content-Type': ['application/json'],
    'Access-Control-Allow-Origin': ['*'],
    'Access-Control-Allow-Headers': ['Content-Type,Authorization,X-Requested-With'],
    'Access-Control-Allow-Methods': ['GET', 'POST', 'DELETE', 'OPTIONS']
}

def create_response(status_code, body=None):
    response = {
        'statusCode': status_code,
        'headers': CORS_HEADERS,
        'multiValueHeaders': CORS_MULTI_HEADERS,
    }
    if body is not None:
        response['body'] = json.dumps(body, cls=DecimalEncoder) if isinstance(body, (dict, list)) else body
    else:
        response['body'] = ''
    return response

def validate_jwt_token(token):
    try:
        if not token:
            return None
        if token.startswith('Bearer '):
            token = token[7:]
        parts = token.split('.')
        if len(parts) != 3:
            return None
        payload_b64 = parts[1]
        padding = 4 - (len(payload_b64) % 4)
        if padding != 4:
            payload_b64 += '=' * padding
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        user_id = payload.get('cognito:username') or payload.get('username') or payload.get('sub')
        if not user_id:
            user_id = payload.get('email')
        return user_id
    except Exception as e:
        logger.error(f"JWT validation error: {str(e)}")
        return None

def get_user_from_event(event):
    headers = event.get('headers', {}) or {}
    auth_header = headers.get('Authorization') or headers.get('authorization')
    if not auth_header:
        return None
    return validate_jwt_token(auth_header)

def handle_options(event):
    if event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
        return create_response(200)
    return None

def generate_kb_id():
    return f"kb-{uuid.uuid4().hex[:12]}"

def generate_agent_id():
    return f"agent-{uuid.uuid4().hex[:12]}"

def generate_conversation_id():
    return f"conv-{uuid.uuid4().hex[:12]}"

def get_account_id():
    return sts.get_caller_identity()['Account']

def create_knowledge_base(user_id, kb_id, name):
    account_id = get_account_id()
    index_name = f"idx-{kb_id}"

    s3vectors.create_index(
        vectorBucketName=VECTOR_BUCKET_NAME,
        indexName=index_name,
        dataType='float32',
        dimension=VECTOR_DIMENSION,
        distanceMetric='euclidean'
    )

    index_arn = f"arn:aws:s3vectors:{AWS_REGION}:{account_id}:bucket/{VECTOR_BUCKET_NAME}/index/{index_name}"

    response = bedrock_agent.create_knowledge_base(
        name=kb_id,
        roleArn=BEDROCK_ROLE_ARN,
        knowledgeBaseConfiguration={
            'type': 'VECTOR',
            'vectorKnowledgeBaseConfiguration': {
                'embeddingModelArn': EMBEDDING_MODEL_ARN,
                'embeddingModelConfiguration': {
                    'bedrockEmbeddingModelConfiguration': {
                        'dimensions': VECTOR_DIMENSION,
                        'embeddingDataType': 'FLOAT32'
                    }
                }
            }
        },
        storageConfiguration={
            'type': 'S3_VECTORS',
            's3VectorsConfiguration': {
                'indexArn': index_arn
            }
        }
    )

    kb_info = response['knowledgeBase']
    bedrock_kb_id = kb_info['knowledgeBaseId']

    doc_prefix = f"users/{user_id}/kbs/{kb_id}/"
    data_source_response = bedrock_agent.create_data_source(
        knowledgeBaseId=bedrock_kb_id,
        name=f"{kb_id}-ds",
        dataSourceConfiguration={
            'type': 'S3',
            's3Configuration': {
                'bucketArn': f"arn:aws:s3:::{DOCUMENTS_BUCKET}",
                'inclusionPrefixes': [doc_prefix]
            }
        },
        vectorIngestionConfiguration={
            'chunkingConfiguration': {
                'chunkingStrategy': CHUNKING_STRATEGY,
                'fixedSizeChunkingConfiguration': {
                    'maxTokens': FIXED_SIZE_MAX_TOKENS,
                    'overlapPercentage': FIXED_SIZE_OVERLAP_PCT
                }
            }
        }
    )

    data_source_id = data_source_response['dataSource']['dataSourceId']

    return bedrock_kb_id, data_source_id, index_arn, doc_prefix

def delete_knowledge_base(bedrock_kb_id, index_arn):
    try:
        data_sources = bedrock_agent.list_data_sources(knowledgeBaseId=bedrock_kb_id)
        for ds in data_sources.get('dataSourceSummaries', []):
            bedrock_agent.delete_data_source(
                knowledgeBaseId=bedrock_kb_id,
                dataSourceId=ds['dataSourceId']
            )
    except Exception as e:
        logger.warning(f"Error deleting data sources: {str(e)}")

    try:
        bedrock_agent.delete_knowledge_base(knowledgeBaseId=bedrock_kb_id)
    except Exception as e:
        logger.warning(f"Error deleting knowledge base: {str(e)}")

    try:
        index_name = index_arn.split('/index/')[-1]
        s3vectors.delete_index(
            vectorBucketName=VECTOR_BUCKET_NAME,
            indexName=index_name
        )
    except Exception as e:
        logger.warning(f"Error deleting vector index: {str(e)}")

def start_ingestion(bedrock_kb_id, data_source_id):
    response = bedrock_agent.start_ingestion_job(
        knowledgeBaseId=bedrock_kb_id,
        dataSourceId=data_source_id
    )
    return response['ingestionJob']['ingestionJobId']

def get_ingestion_status(bedrock_kb_id, data_source_id, job_id):
    response = bedrock_agent.get_ingestion_job(
        knowledgeBaseId=bedrock_kb_id,
        dataSourceId=data_source_id,
        ingestionJobId=job_id
    )
    job = response['ingestionJob']
    return {
        'jobId': job['ingestionJobId'],
        'status': job['status'],
        'error': job.get('error', ''),
        'statistics': {
            'numberofDocumentsScanned': job.get('statistics', {}).get('numberofDocumentsScanned', 0),
            'numberofNewDocumentsIndexed': job.get('statistics', {}).get('numberofNewDocumentsIndexed', 0),
            'numberofModifiedDocumentsIndexed': job.get('statistics', {}).get('numberofModifiedDocumentsIndexed', 0),
            'numberofDocumentsDeleted': job.get('statistics', {}).get('numberofDocumentsDeleted', 0),
            'numberofDocumentsFailed': job.get('statistics', {}).get('numberofDocumentsFailed', 0)
        }
    }

def list_s3_files(bucket, prefix):
    files = []
    paginator = s3.get_paginator('list_objects_v2')
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get('Contents', []):
            if not obj['Key'].endswith('/'):
                files.append({
                    'key': obj['Key'],
                    'name': obj['Key'].split('/')[-1],
                    'size': obj['Size'],
                    'lastModified': obj['LastModified'].isoformat(),
                    'etag': obj['ETag'].strip('"')
                })
    return files

def refresh_kb_status(user_id, kb_id, bedrock_kb_id):
    """Check Bedrock for actual KB status and update DynamoDB if changed."""
    try:
        response = bedrock_agent.get_knowledge_base(knowledgeBaseId=bedrock_kb_id)
        actual_status = response['knowledgeBase']['status']
        kbs_table.update_item(
            Key={'userId': user_id, 'kbId': kb_id},
            UpdateExpression='SET #st = :status, updatedAt = :now',
            ExpressionAttributeNames={'#st': 'status'},
            ExpressionAttributeValues={
                ':status': actual_status,
                ':now': datetime.utcnow().isoformat()
            }
        )
        return actual_status
    except Exception as e:
        logger.warning(f"Failed to refresh KB status: {str(e)}")
        return None

def refresh_document_count(user_id, kb_id, s3_prefix):
    """Count files in S3 for the KB prefix and update DynamoDB."""
    try:
        files = list_s3_files(DOCUMENTS_BUCKET, s3_prefix)
        count = len(files)
        kbs_table.update_item(
            Key={'userId': user_id, 'kbId': kb_id},
            UpdateExpression='SET documentCount = :dc, updatedAt = :now',
            ExpressionAttributeValues={
                ':dc': count,
                ':now': datetime.utcnow().isoformat()
            }
        )
        return count
    except Exception as e:
        logger.warning(f"Failed to refresh document count: {str(e)}")
        return None

def get_presigned_url(bucket, key, content_type=None):
    params = {
        'Bucket': bucket,
        'Key': key,
    }
    if content_type:
        params['ContentType'] = content_type
    return s3.generate_presigned_url('put_object', Params=params, ExpiresIn=3600)
