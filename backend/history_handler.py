import json
import logging
from utils import (
    create_response, get_user_from_event, handle_options,
    conversations_table, HISTORY_BUCKET, s3, logger
)

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
    logger.info(f"History: {method} {route} user={user_id}")

    try:
        # GET /history - List conversations
        if method == 'GET' and route == '/history':
            return handle_list_conversations(user_id, query_params)

        # GET /history/{id} - Get conversation MD content
        if method == 'GET' and route.startswith('/history/'):
            return handle_get_conversation(user_id, path_params['id'])

        # DELETE /history/{id} - Delete conversation
        if method == 'DELETE' and route.startswith('/history/'):
            return handle_delete_conversation(user_id, path_params['id'])

        return create_response(404, {'message': 'Not found'})
    except Exception as e:
        logger.error(f"History error: {str(e)}", exc_info=True)
        return create_response(500, {'message': 'Internal server error'})


def handle_list_conversations(user_id, query_params):
    search = query_params.get('search', '').strip().lower()
    limit = int(query_params.get('limit', 50))

    if search:
        response = conversations_table.query(
            KeyConditionExpression='userId = :uid',
            ExpressionAttributeValues={':uid': user_id},
            Limit=limit
        )
        items = response.get('Items', [])
        filtered = [i for i in items if search in i.get('title', '').lower() or search in i.get('conversationId', '').lower()]
        items = filtered
    else:
        response = conversations_table.query(
            KeyConditionExpression='userId = :uid',
            ExpressionAttributeValues={':uid': user_id},
            ScanIndexForward=False,
            Limit=limit
        )
        items = response.get('Items', [])

    return create_response(200, {
        'conversations': items,
        'count': len(items)
    })


def handle_get_conversation(user_id, conversation_id):
    response = conversations_table.get_item(Key={'userId': user_id, 'conversationId': conversation_id})
    conv = response.get('Item')
    if not conv:
        return create_response(404, {'message': 'Conversation not found'})

    s3_key = conv.get('s3Key', f"users/{user_id}/conversations/{conversation_id}.md")
    try:
        s3_response = s3.get_object(Bucket=HISTORY_BUCKET, Key=s3_key)
        content = s3_response['Body'].read().decode('utf-8')
        return create_response(200, {
            'conversationId': conversation_id,
            'metadata': conv,
            'content': content
        })
    except Exception as e:
        logger.warning(f"Failed to read S3 content: {str(e)}")
        return create_response(200, {
            'conversationId': conversation_id,
            'metadata': conv,
            'content': ''
        })


def handle_delete_conversation(user_id, conversation_id):
    response = conversations_table.get_item(Key={'userId': user_id, 'conversationId': conversation_id})
    conv = response.get('Item')
    if not conv:
        return create_response(404, {'message': 'Conversation not found'})

    s3_key = conv.get('s3Key', f"users/{user_id}/conversations/{conversation_id}.md")
    try:
        s3.delete_object(Bucket=HISTORY_BUCKET, Key=s3_key)
    except Exception as e:
        logger.warning(f"Failed to delete S3 object: {str(e)}")

    conversations_table.delete_item(Key={'userId': user_id, 'conversationId': conversation_id})
    return create_response(200, {'message': 'Conversation deleted'})
