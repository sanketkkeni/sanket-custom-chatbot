import json
import logging
from datetime import datetime
from utils import (
    create_response, get_user_from_event, handle_options,
    kbs_table, agents_table, conversations_table,
    HISTORY_BUCKET, CHAT_MODEL_ARN, AWS_REGION,
    bedrock_agent_runtime, s3, logger, generate_conversation_id
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
    logger.info(f"Chat: {method} {route} user={user_id}")

    try:
        body = {}
        if event.get('body'):
            body = json.loads(event['body'])

        if method == 'POST' and route == '/chat':
            return handle_chat(user_id, body)

        return create_response(404, {'message': 'Not found'})
    except Exception as e:
        logger.error(f"Chat error: {str(e)}", exc_info=True)
        return create_response(500, {'message': 'Internal server error'})


def handle_chat(user_id, body):
    kb_id = body.get('kbId', '')
    message = body.get('message', '').strip()
    agent_id = body.get('agentId', '')
    conversation_id = body.get('conversationId', '')

    if not kb_id or not message:
        return create_response(400, {'message': 'kbId and message are required'})

    kb_response = kbs_table.get_item(Key={'userId': user_id, 'kbId': kb_id})
    kb = kb_response.get('Item')
    if not kb:
        return create_response(404, {'message': 'KB not found'})

    bedrock_kb_id = kb.get('bedrockKbId', '')
    if not bedrock_kb_id:
        return create_response(400, {'message': 'KB not fully configured'})

    if not conversation_id:
        conversation_id = generate_conversation_id()

    # Get agent instructions if agent_id is provided
    instructions = ''
    agent_name = ''
    if agent_id:
        agent_response = agents_table.get_item(Key={'userId': user_id, 'agentId': agent_id})
        agent = agent_response.get('Item')
        if agent:
            instructions = agent.get('instructions', '')
            agent_name = agent.get('name', '')
            kb_id = agent.get('kbId', kb_id)

    # Build the query configuration
    model_arn = CHAT_MODEL_ARN
    query_config = {
        'knowledgeBaseId': bedrock_kb_id,
        'modelArn': model_arn
    }

    if instructions:
        query_config['generationConfiguration'] = {
            'promptTemplate': {
                'textPromptTemplate': (
                    'You are a helpful assistant. Use the provided knowledge base to answer questions.\n'
                    f'Additional instructions: {instructions}\n\n'
                    'Human: {input_text}\n\n'
                    'Use the following context from the knowledge base to answer:\n{context}\n\n'
                    'Assistant:'
                )
            }
        }

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

        # Extract sources
        sources = []
        for citation in citations:
            for ref in citation.get('retrievedReferences', []):
                location = ref.get('location', {})
                s3_location = location.get('s3Location', {}) or {}
                if s3_location.get('uri'):
                    sources.append({
                        'uri': s3_location['uri'],
                        'content': ref.get('content', {}).get('text', '')[:200]
                    })

        # Save conversation history to S3 as MD
        s3_key = f"users/{user_id}/conversations/{conversation_id}.md"

        try:
            existing = s3.get_object(Bucket=HISTORY_BUCKET, Key=s3_key)
            existing_content = existing['Body'].read().decode('utf-8')
        except:
            existing_content = (
                f"---\nconversationId: {conversation_id}\nuserId: {user_id}\n"
                f"kbId: {kb_id}\nagentId: {agent_id}\nagentName: {agent_name}\n"
                f"createdAt: {datetime.utcnow().isoformat()}\n---\n\n"
            )

        timestamp = datetime.utcnow().isoformat()
        new_entry = (
            f"### {timestamp}\n\n"
            f"**User**: {message}\n\n"
            f"**Assistant**: {output_text}\n\n"
        )
        if sources:
            new_entry += "**Sources**:\n"
            for s in sources:
                new_entry += f"- {s['uri']}\n"
            new_entry += "\n"

        updated_content = existing_content + new_entry

        s3.put_object(
            Bucket=HISTORY_BUCKET,
            Key=s3_key,
            Body=updated_content.encode('utf-8'),
            ContentType='text/markdown'
        )

        # Upsert conversation metadata in DynamoDB
        try:
            conv_response = conversations_table.get_item(Key={'userId': user_id, 'conversationId': conversation_id})
            if 'Item' not in conv_response:
                # Count messages to create a default title
                message_count = 1
                title = message[:100] if len(message) > 100 else message
                conversations_table.put_item(Item={
                    'userId': user_id,
                    'conversationId': conversation_id,
                    'agentId': agent_id,
                    'kbId': kb_id,
                    'title': title,
                    's3Key': s3_key,
                    'messageCount': message_count,
                    'createdAt': datetime.utcnow().isoformat(),
                    'updatedAt': datetime.utcnow().isoformat()
                })
            else:
                conversations_table.update_item(
                    Key={'userId': user_id, 'conversationId': conversation_id},
                    UpdateExpression='ADD messageCount :inc SET updatedAt = :now',
                    ExpressionAttributeValues={
                        ':inc': 1,
                        ':now': datetime.utcnow().isoformat()
                    }
                )
        except Exception as e:
            logger.warning(f"Failed to update conversation metadata: {str(e)}")

        return create_response(200, {
            'response': output_text,
            'sources': sources,
            'conversationId': conversation_id
        })

    except Exception as e:
        logger.error(f"Chat error: {str(e)}", exc_info=True)
        return create_response(500, {'message': f'Chat failed: {str(e)}'})
