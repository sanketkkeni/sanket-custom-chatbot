import json
import os
import time
import logging
import uuid
from boto3.dynamodb.conditions import Key
from utils import (
    create_response, logger, bedrock_agent_runtime,
    kbs_table, CHAT_MODEL_ARN
)

OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')

def _get_header(headers, name):
    if not headers:
        return None
    for key, value in headers.items():
        if key.lower() == name.lower():
            return value
    return None

def validate_api_key(event):
    headers = event.get('headers', {}) or {}
    api_key = _get_header(headers, 'x-api-key')
    return api_key and api_key == OPENAI_API_KEY

def get_user_id_from_event(event):
    headers = event.get('headers', {}) or {}
    return _get_header(headers, 'X-OpenWebUI-User-Id')

def lambda_handler(event, context):
    if event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
        return create_response(200, {'message': 'OK'})

    if not validate_api_key(event):
        return create_response(401, {'message': 'Unauthorized'})

    user_id = get_user_id_from_event(event)
    if not user_id:
        return create_response(403, {'message': 'User identity not found'})

    method = event.get('requestContext', {}).get('http', {}).get('method')
    route = event.get('requestContext', {}).get('http', {}).get('path', '')

    if method == 'GET' and route == '/v1/models':
        return handle_list_models(user_id)
    elif method == 'POST' and route == '/v1/chat/completions':
        return handle_chat_completions(event, user_id)

    return create_response(404, {'message': 'Not found'})

def handle_list_models(user_id):
    try:
        response = kbs_table.query(
            KeyConditionExpression=Key('userId').eq(user_id),
            FilterExpression='attribute_exists(bedrockKbId) AND #st = :active',
            ExpressionAttributeNames={'#st': 'status'},
            ExpressionAttributeValues={':active': 'ACTIVE'},
            ProjectionExpression='kbId, #st, name, updatedAt'
        )
        models = []
        for item in response.get('Items', []):
            created = int(time.mktime(
                time.strptime(item.get('updatedAt', '1970-01-01T00:00:00')[:19], '%Y-%m-%dT%H:%M:%S')
            )) if item.get('updatedAt') else 0
            models.append({
                'id': item['kbId'],
                'object': 'model',
                'created': created,
                'owned_by': 'system',
                'name': item.get('name', '')
            })
        return create_response(200, {
            'object': 'list',
            'data': models
        })
    except Exception as e:
        logger.error(f"Error listing models: {str(e)}", exc_info=True)
        return create_response(500, {'message': 'Failed to list models'})

def handle_chat_completions(event, user_id):
    try:
        body = json.loads(event.get('body', '{}'))
    except json.JSONDecodeError:
        return create_response(400, {'message': 'Invalid JSON body'})

    stream = body.get('stream', False)
    kb_id = body.get('model', '')
    messages = body.get('messages', [])

    if not kb_id:
        return create_response(400, {'message': 'model (kbId) is required'})
    if not messages:
        return create_response(400, {'message': 'messages is required'})

    kb_response = kbs_table.get_item(Key={'userId': user_id, 'kbId': kb_id})
    kb = kb_response.get('Item')
    if not kb:
        return create_response(404, {'message': 'Knowledge base not found'})
    bedrock_kb_id = kb.get('bedrockKbId', '')
    if not bedrock_kb_id:
        return create_response(400, {'message': 'KB not fully configured'})

    user_message = None
    system_message = None
    for msg in messages:
        if msg.get('role') == 'user':
            user_message = msg.get('content', '')
        elif msg.get('role') == 'system':
            system_message = msg.get('content', '')

    if not user_message:
        return create_response(400, {'message': 'No user message found'})

    model_arn = CHAT_MODEL_ARN
    prompt = (
        'You are a helpful assistant. Use the provided knowledge base to answer questions.\n'
        'If the user greets you or makes small talk, respond naturally.\n'
        'If the search results contain relevant information, use it to answer.\n'
        'If the search results are empty or irrelevant, let the user know you can help with their documents.\n'
    )
    if system_message:
        prompt += f'System instructions: {system_message}\n\n'

    prompt += (
        'Search results:\n$search_results$\n\n'
        'Assistant:'
    )

    query_config = {
        'knowledgeBaseId': bedrock_kb_id,
        'modelArn': model_arn,
        'generationConfiguration': {
            'promptTemplate': {
                'textPromptTemplate': prompt
            }
        }
    }

    if stream:
        return handle_streaming_chat(query_config, user_message, kb_id)
    else:
        return handle_non_streaming_chat(query_config, user_message, kb_id)

def handle_non_streaming_chat(query_config, message, model_id):
    try:
        response = bedrock_agent_runtime.retrieve_and_generate(
            input={'text': message},
            retrieveAndGenerateConfiguration={
                'type': 'KNOWLEDGE_BASE',
                'knowledgeBaseConfiguration': query_config
            }
        )

        output_text = response.get('output', {}).get('text', '')
        citations = response.get('citations', [])

        sources = []
        seen = set()
        for citation in citations:
            for ref in citation.get('retrievedReferences', []):
                location = ref.get('location', {})
                s3_location = location.get('s3Location', {}) or {}
                uri = s3_location.get('uri', '')
                if not uri:
                    continue
                metadata = ref.get('metadata', {}) or {}
                chunk_id = metadata.get('x-amz-bedrock-kb-chunk-id', '') or uri
                if chunk_id not in seen:
                    seen.add(chunk_id)
                    sources.append({
                        'uri': uri,
                        'fileName': uri.split('/')[-1],
                        'content': ref.get('content', {}).get('text', '')[:200],
                        'chunkId': metadata.get('x-amz-bedrock-kb-chunk-id', ''),
                        'pageNumber': metadata.get('x-amz-bedrock-kb-document-page-number'),
                        'dataSourceId': metadata.get('x-amz-bedrock-kb-data-source-id', ''),
                    })

        chat_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
        return create_response(200, {
            'id': chat_id,
            'object': 'chat.completion',
            'created': int(time.time()),
            'model': model_id,
            'choices': [{
                'index': 0,
                'message': {
                    'role': 'assistant',
                    'content': output_text
                },
                'finish_reason': 'stop'
            }],
            'usage': {
                'prompt_tokens': 0,
                'completion_tokens': 0,
                'total_tokens': 0
            },
            'sources': sources
        })
    except Exception as e:
        logger.error(f"Chat error: {str(e)}", exc_info=True)
        return create_response(500, {'message': f'Chat failed: {str(e)}'})

def handle_streaming_chat(query_config, message, model_id):
    try:
        response = bedrock_agent_runtime.retrieve_and_generate_stream(
            input={'text': message},
            retrieveAndGenerateConfiguration={
                'type': 'KNOWLEDGE_BASE',
                'knowledgeBaseConfiguration': query_config
            }
        )

        chat_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
        events = []

        # First chunk with role
        first_event = {
            'id': chat_id,
            'object': 'chat.completion.chunk',
            'created': int(time.time()),
            'model': model_id,
            'choices': [{
                'index': 0,
                'delta': {'role': 'assistant', 'content': ''},
                'finish_reason': None
            }]
        }
        events.append(f"data: {json.dumps(first_event)}\n\n")

        # Stream events
        for stream_event in response.get('stream', []):
            if 'output' in stream_event:
                text = stream_event['output']['text']
                chunk = {
                    'id': chat_id,
                    'object': 'chat.completion.chunk',
                    'created': int(time.time()),
                    'model': model_id,
                    'choices': [{
                        'index': 0,
                        'delta': {'content': text},
                        'finish_reason': None
                    }]
                }
                events.append(f"data: {json.dumps(chunk)}\n\n")

        # Final chunk with finish_reason
        final_chunk = {
            'id': chat_id,
            'object': 'chat.completion.chunk',
            'created': int(time.time()),
            'model': model_id,
            'choices': [{
                'index': 0,
                'delta': {},
                'finish_reason': 'stop'
            }]
        }
        events.append(f"data: {json.dumps(final_chunk)}\n\n")
        events.append("data: [DONE]\n")

        body = ''.join(events)
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key,x-api-key',
                'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
            },
            'body': body
        }
    except Exception as e:
        logger.error(f"Streaming chat error: {str(e)}", exc_info=True)
        error_body = f"data: {json.dumps({'error': {'message': str(e)}})}\n\ndata: [DONE]\n"
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key,x-api-key',
                'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
            },
            'body': error_body
        }
