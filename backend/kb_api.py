import json
import os
import uuid
import logging
from datetime import datetime
from utils import (
    create_response, get_user_from_event, handle_options, kbs_table, agents_table,
    DOCUMENTS_BUCKET, generate_kb_id, generate_agent_id,
    create_knowledge_base, delete_knowledge_base, start_ingestion,
    get_ingestion_status, list_s3_files, get_presigned_url,
    refresh_kb_status, refresh_document_count, refresh_kb_sync_status,
    bedrock_agent, s3, logger
)

MAX_KBS_PER_USER = 10

def lambda_handler(event, context):
    options_response = handle_options(event)
    if options_response:
        return options_response

    user_id = get_user_from_event(event)
    if not user_id:
        return create_response(401, {'message': 'Unauthorized'})

    method = event.get('requestContext', {}).get('http', {}).get('method')
    route = event.get('requestContext', {}).get('http', {}).get('path', '')
    path_params = event.get('pathParameters', {}) or {}
    query_params = event.get('queryStringParameters', {}) or {}
    logger.info(f"KB API: {method} {route} user={user_id}")

    try:
        body = {}
        if event.get('body'):
            body = json.loads(event['body'])

        # POST /kbs - Create KB
        if method == 'POST' and route == '/kbs':
            return handle_create_kb(user_id, body)

        # GET /kbs - List KBs
        if method == 'GET' and route == '/kbs':
            return handle_list_kbs(user_id, query_params)

        # GET /kbs/{id} - Get KB details
        if method == 'GET' and route.startswith('/kbs/') and not any(x in route for x in ['/files', '/sync', '/stats', '/upload']):
            return handle_get_kb(user_id, path_params['id'])

        # DELETE /kbs/{id} - Delete KB
        if method == 'DELETE' and route.startswith('/kbs/'):
            return handle_delete_kb(user_id, path_params['id'])

        # POST /kbs/{id}/upload - Generate presigned URL
        if method == 'POST' and route.endswith('/upload'):
            return handle_upload_file(user_id, path_params['id'], body)

        # GET /kbs/{id}/files - List files
        if method == 'GET' and route.endswith('/files'):
            return handle_list_files(user_id, path_params['id'])

        # DELETE /kbs/{id}/files/{file} - Delete file
        if method == 'DELETE' and '/files/' in route:
            kb_id = path_params['id']
            file_key = path_params.get('file', '')
            return handle_delete_file(user_id, kb_id, file_key)

        # POST /kbs/{id}/sync - Start ingestion
        if method == 'POST' and route.endswith('/sync'):
            return handle_start_sync(user_id, path_params['id'])

        # GET /kbs/{id}/sync - Get sync status
        if method == 'GET' and route.endswith('/sync'):
            return handle_get_sync_status(user_id, path_params['id'])

        # GET /kbs/{id}/stats - Get KB stats
        if method == 'GET' and route.endswith('/stats'):
            return handle_get_stats(user_id, path_params['id'])

        return create_response(404, {'message': 'Not found'})

    except Exception as e:
        logger.error(f"KB API error: {str(e)}", exc_info=True)
        return create_response(500, {'message': 'Internal server error'})


def handle_create_kb(user_id, body):
    name = body.get('name', '').strip()
    if not name:
        return create_response(400, {'message': 'Name is required'})

    response = kbs_table.query(
        KeyConditionExpression='userId = :uid',
        ExpressionAttributeValues={':uid': user_id}
    )
    if response['Count'] >= MAX_KBS_PER_USER:
        return create_response(400, {'message': f'Maximum {MAX_KBS_PER_USER} KBs per user'})

    kb_id = generate_kb_id()
    try:
        bedrock_kb_id, data_source_id, index_arn, doc_prefix = create_knowledge_base(user_id, kb_id, name)

        kbs_table.put_item(Item={
            'userId': user_id,
            'kbId': kb_id,
            'name': name,
            'status': 'CREATING',
            'bedrockKbId': bedrock_kb_id,
            'dataSourceId': data_source_id,
            's3BucketName': DOCUMENTS_BUCKET,
            's3Prefix': doc_prefix,
            'vectorIndexArn': index_arn,
            'documentCount': 0,
            'indexedCount': 0,
            'lastSyncStatus': 'NONE',
            'lastSyncError': '',
            'createdAt': datetime.utcnow().isoformat(),
            'updatedAt': datetime.utcnow().isoformat()
        })

        return create_response(201, {
            'kbId': kb_id,
            'name': name,
            'status': 'CREATING',
            'bedrockKbId': bedrock_kb_id
        })
    except Exception as e:
        logger.error(f"Create KB failed: {str(e)}", exc_info=True)
        return create_response(500, {'message': f'Failed to create knowledge base: {str(e)}'})


def handle_list_kbs(user_id, query_params):
    response = kbs_table.query(
        KeyConditionExpression='userId = :uid',
        ExpressionAttributeValues={':uid': user_id}
    )
    items = response.get('Items', [])
    for item in items:
        item.pop('vectorIndexArn', None)
        # Refresh status if stuck at CREATING
        if item.get('status') == 'CREATING' and item.get('bedrockKbId'):
            new_status = refresh_kb_status(user_id, item['kbId'], item['bedrockKbId'])
            if new_status:
                item['status'] = new_status
        # Refresh sync status if stuck at IN_PROGRESS
        if item.get('lastSyncStatus') == 'IN_PROGRESS' and item.get('bedrockKbId') and item.get('dataSourceId') and item.get('lastSyncJobId'):
            new_sync_status = refresh_kb_sync_status(user_id, item['kbId'], item['bedrockKbId'], item['dataSourceId'], item['lastSyncJobId'])
            if new_sync_status:
                item['lastSyncStatus'] = new_sync_status
        # Refresh document count from S3
        s3_prefix = item.get('s3Prefix', f"users/{user_id}/kbs/{item['kbId']}/")
        real_count = refresh_document_count(user_id, item['kbId'], s3_prefix)
        if real_count is not None:
            item['documentCount'] = real_count
    return create_response(200, {'kbs': items, 'count': len(items)})


def handle_get_kb(user_id, kb_id):
    response = kbs_table.get_item(Key={'userId': user_id, 'kbId': kb_id})
    kb = response.get('Item')
    if not kb:
        return create_response(404, {'message': 'KB not found'})
    # Refresh status if stuck at CREATING
    if kb.get('status') == 'CREATING' and kb.get('bedrockKbId'):
        new_status = refresh_kb_status(user_id, kb_id, kb['bedrockKbId'])
        if new_status:
            kb['status'] = new_status
    # Refresh sync status if stuck at IN_PROGRESS
    if kb.get('lastSyncStatus') == 'IN_PROGRESS' and kb.get('bedrockKbId') and kb.get('dataSourceId') and kb.get('lastSyncJobId'):
        new_sync_status = refresh_kb_sync_status(user_id, kb_id, kb['bedrockKbId'], kb['dataSourceId'], kb['lastSyncJobId'])
        if new_sync_status:
            kb['lastSyncStatus'] = new_sync_status
    # Refresh document count from S3
    s3_prefix = kb.get('s3Prefix', f"users/{user_id}/kbs/{kb_id}/")
    real_count = refresh_document_count(user_id, kb_id, s3_prefix)
    if real_count is not None:
        kb['documentCount'] = real_count
    return create_response(200, kb)


def handle_delete_kb(user_id, kb_id):
    response = kbs_table.get_item(Key={'userId': user_id, 'kbId': kb_id})
    kb = response.get('Item')
    if not kb:
        return create_response(404, {'message': 'KB not found'})

    bedrock_kb_id = kb.get('bedrockKbId', '')
    index_arn = kb.get('vectorIndexArn', '')

    try:
        if bedrock_kb_id and index_arn:
            delete_knowledge_base(bedrock_kb_id, index_arn)

        doc_prefix = kb.get('s3Prefix', f"users/{user_id}/kbs/{kb_id}/")
        s3_objects = s3.list_objects_v2(Bucket=DOCUMENTS_BUCKET, Prefix=doc_prefix)
        if 'Contents' in s3_objects:
            s3.delete_objects(
                Bucket=DOCUMENTS_BUCKET,
                Delete={'Objects': [{'Key': obj['Key']} for obj in s3_objects['Contents']]}
            )

        kbs_table.delete_item(Key={'userId': user_id, 'kbId': kb_id})

        # Delete associated agents
        agent_results = agents_table.query(
            IndexName='kbId-index',
            KeyConditionExpression='kbId = :kid',
            ExpressionAttributeValues={':kid': kb_id}
        )
        for agent in agent_results.get('Items', []):
            agents_table.delete_item(Key={'userId': agent['userId'], 'agentId': agent['agentId']})

        return create_response(200, {'message': 'KB deleted'})
    except Exception as e:
        logger.error(f"Delete KB failed: {str(e)}", exc_info=True)
        return create_response(500, {'message': f'Failed to delete: {str(e)}'})


def handle_upload_file(user_id, kb_id, body):
    response = kbs_table.get_item(Key={'userId': user_id, 'kbId': kb_id})
    if not response.get('Item'):
        return create_response(404, {'message': 'KB not found'})

    filename = body.get('filename', '')
    content_type = body.get('contentType', 'application/octet-stream')
    if not filename:
        return create_response(400, {'message': 'filename is required'})

    doc_prefix = response['Item'].get('s3Prefix', f"users/{user_id}/kbs/{kb_id}/")
    key = f"{doc_prefix}{filename}"

    presigned_url = get_presigned_url(DOCUMENTS_BUCKET, key, content_type)
    return create_response(200, {'presignedUrl': presigned_url, 'key': key})


def handle_list_files(user_id, kb_id):
    response = kbs_table.get_item(Key={'userId': user_id, 'kbId': kb_id})
    if not response.get('Item'):
        return create_response(404, {'message': 'KB not found'})

    doc_prefix = response['Item'].get('s3Prefix', f"users/{user_id}/kbs/{kb_id}/")
    files = list_s3_files(DOCUMENTS_BUCKET, doc_prefix)
    return create_response(200, {'files': files, 'count': len(files)})


def handle_delete_file(user_id, kb_id, file_key):
    response = kbs_table.get_item(Key={'userId': user_id, 'kbId': kb_id})
    if not response.get('Item'):
        return create_response(404, {'message': 'KB not found'})

    doc_prefix = response['Item'].get('s3Prefix', f"users/{user_id}/kbs/{kb_id}/")
    full_key = f"{doc_prefix}{file_key}"

    try:
        s3.delete_object(Bucket=DOCUMENTS_BUCKET, Key=full_key)
        return create_response(200, {'message': 'File deleted'})
    except Exception as e:
        return create_response(500, {'message': f'Failed to delete file: {str(e)}'})


def handle_start_sync(user_id, kb_id):
    response = kbs_table.get_item(Key={'userId': user_id, 'kbId': kb_id})
    kb = response.get('Item')
    if not kb:
        return create_response(404, {'message': 'KB not found'})

    bedrock_kb_id = kb.get('bedrockKbId', '')
    data_source_id = kb.get('dataSourceId', '')

    if not bedrock_kb_id or not data_source_id:
        return create_response(400, {'message': 'KB not fully configured'})

    try:
        job_id = start_ingestion(bedrock_kb_id, data_source_id)
        kbs_table.update_item(
            Key={'userId': user_id, 'kbId': kb_id},
            UpdateExpression='SET lastSyncStatus = :status, lastSyncJobId = :jobId, updatedAt = :now',
            ExpressionAttributeValues={
                ':status': 'IN_PROGRESS',
                ':jobId': job_id,
                ':now': datetime.utcnow().isoformat()
            }
        )
        return create_response(200, {'jobId': job_id, 'status': 'IN_PROGRESS'})
    except Exception as e:
        return create_response(500, {'message': f'Failed to start ingestion: {str(e)}'})


def handle_get_sync_status(user_id, kb_id):
    response = kbs_table.get_item(Key={'userId': user_id, 'kbId': kb_id})
    kb = response.get('Item')
    if not kb:
        return create_response(404, {'message': 'KB not found'})

    bedrock_kb_id = kb.get('bedrockKbId', '')
    data_source_id = kb.get('dataSourceId', '')
    job_id = kb.get('lastSyncJobId', '')

    if not job_id:
        return create_response(200, {'status': 'NONE', 'message': 'No sync job started yet'})

    try:
        status = get_ingestion_status(bedrock_kb_id, data_source_id, job_id)

        if status['status'] in ['COMPLETE', 'FAILED', 'STOPPED']:
            update_expr = 'SET lastSyncStatus = :status, lastSyncError = :err, updatedAt = :now'
            expr_attrs = {
                ':status': status['status'],
                ':err': status.get('error', ''),
                ':now': datetime.utcnow().isoformat()
            }
            if status['status'] == 'COMPLETE' and status.get('statistics'):
                new_count = status['statistics'].get('numberofNewDocumentsIndexed', 0)
                if new_count > 0:
                    update_expr += ', indexedCount = indexedCount + :dc'
                    expr_attrs[':dc'] = new_count

            kbs_table.update_item(
                Key={'userId': user_id, 'kbId': kb_id},
                UpdateExpression=update_expr,
                ExpressionAttributeValues=expr_attrs
            )

        return create_response(200, status)
    except Exception as e:
        return create_response(500, {'message': f'Failed to get sync status: {str(e)}'})


def handle_get_stats(user_id, kb_id):
    response = kbs_table.get_item(Key={'userId': user_id, 'kbId': kb_id})
    kb = response.get('Item')
    if not kb:
        return create_response(404, {'message': 'KB not found'})

    doc_prefix = kb.get('s3Prefix', f"users/{user_id}/kbs/{kb_id}/")
    files = list_s3_files(DOCUMENTS_BUCKET, doc_prefix)

    total_size = sum(f['size'] for f in files)
    supported_types = ['.pdf', '.txt', '.md', '.html', '.csv', '.doc', '.docx', '.xls', '.xlsx']
    by_type = {}
    for f in files:
        ext = os.path.splitext(f['name'])[1].lower()
        by_type[ext] = by_type.get(ext, 0) + 1

    return create_response(200, {
        'kbId': kb_id,
        'name': kb.get('name', ''),
        'status': kb.get('status', ''),
        'documentCount': kb.get('documentCount', 0),
        'indexedCount': kb.get('indexedCount', 0),
        'lastSyncStatus': kb.get('lastSyncStatus', 'NONE'),
        'lastSyncError': kb.get('lastSyncError', ''),
        'totalFiles': len(files),
        'totalSizeBytes': total_size,
        'filesByType': by_type
    })
