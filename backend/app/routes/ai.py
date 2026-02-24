"""
AI Chat Routes

Blueprint for the AI assistant feature. Provides:
  - SSE streaming chat endpoint (POST /chat)
  - Conversation CRUD (list, create, get, update, delete)
  - Settings management (get, update)
  - Status check (is API key configured?)

The /chat endpoint uses Server-Sent Events (SSE) to stream responses
from the Anthropic API in real-time. Tool calls are executed server-side
and results are fed back to Claude automatically.
"""
import json
from flask import Blueprint, request, jsonify, Response, stream_with_context, current_app
from app import db
from app.models.ai_chat import Conversation, Message
from app.services.chat_tools import get_tool_definitions, execute_tool, build_system_context
from app.services.ai_settings import (
    get_settings, get_system_prompt, get_model,
    update_settings, get_default_prompt
)

ai_bp = Blueprint('ai', __name__)


# ── Status ──────────────────────────────────────────────────────────

@ai_bp.route('/status', methods=['GET'])
def ai_status():
    """Check if the Anthropic API key is configured."""
    api_key = current_app.config.get('ANTHROPIC_API_KEY', '')
    return jsonify({
        'configured': bool(api_key and len(api_key) > 10),
    })


# ── Settings ────────────────────────────────────────────────────────

@ai_bp.route('/settings', methods=['GET'])
def get_ai_settings():
    """Get current AI settings (model, system prompt, default prompt)."""
    settings = get_settings()
    return jsonify({
        **settings.to_dict(),
        'default_prompt': get_default_prompt(),
    })


@ai_bp.route('/settings', methods=['PUT'])
def update_ai_settings():
    """Update AI settings (model, system prompt)."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body required'}), 400

    settings = update_settings(
        model=data.get('model'),
        system_prompt=data.get('system_prompt'),
    )
    return jsonify(settings.to_dict())


# ── Conversations ───────────────────────────────────────────────────

@ai_bp.route('/conversations', methods=['GET'])
def list_conversations():
    """List all conversations, newest first."""
    conversations = (Conversation.query
                     .filter_by(is_archived=False)
                     .order_by(Conversation.updated_at.desc())
                     .all())
    return jsonify([c.to_dict() for c in conversations])


@ai_bp.route('/conversations', methods=['POST'])
def create_conversation():
    """Create a new conversation."""
    data = request.get_json() or {}
    conversation = Conversation(
        title=data.get('title'),
        model=get_model(),
    )
    db.session.add(conversation)
    db.session.commit()
    return jsonify(conversation.to_dict()), 201


@ai_bp.route('/conversations/<int:conversation_id>', methods=['GET'])
def get_conversation(conversation_id):
    """Get a conversation with all its messages."""
    conversation = Conversation.query.get_or_404(conversation_id)
    return jsonify(conversation.to_dict(include_messages=True))


@ai_bp.route('/conversations/<int:conversation_id>', methods=['PUT'])
def update_conversation(conversation_id):
    """Update a conversation (rename title, archive)."""
    conversation = Conversation.query.get_or_404(conversation_id)
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body required'}), 400

    if 'title' in data:
        conversation.title = data['title']
    if 'is_archived' in data:
        conversation.is_archived = data['is_archived']

    db.session.commit()
    return jsonify(conversation.to_dict())


@ai_bp.route('/conversations/<int:conversation_id>', methods=['DELETE'])
def delete_conversation(conversation_id):
    """Delete a conversation and all its messages."""
    conversation = Conversation.query.get_or_404(conversation_id)
    db.session.delete(conversation)
    db.session.commit()
    return jsonify({'success': True})


# ── Chat (SSE Streaming) ───────────────────────────────────────────

@ai_bp.route('/chat', methods=['POST'])
def chat():
    """
    Stream a chat response via Server-Sent Events (SSE).

    Request body:
      - conversation_id: (optional) existing conversation ID
      - message: the user's message text
      - model: (optional) override model for this request

    SSE event types:
      - text_delta: partial text chunk from the assistant
      - tool_use: the assistant is calling a tool (for UI indicator)
      - tool_result: result from a tool call (for transparency)
      - message_stop: response complete, includes token_count
      - error: an error occurred
    """
    # Validate API key
    api_key = current_app.config.get('ANTHROPIC_API_KEY', '')
    if not api_key or len(api_key) < 10:
        return jsonify({'error': 'Anthropic API key not configured. Add ANTHROPIC_API_KEY to your environment.'}), 503

    data = request.get_json()
    if not data or not data.get('message', '').strip():
        return jsonify({'error': 'Message is required'}), 400

    user_message = data['message'].strip()
    conversation_id = data.get('conversation_id')
    model_override = data.get('model')

    # Load or create conversation
    if conversation_id:
        conversation = Conversation.query.get(conversation_id)
        if not conversation:
            return jsonify({'error': 'Conversation not found'}), 404
    else:
        # Temporary title until AI generates one after first exchange
        conversation = Conversation(
            title=user_message[:40],
            model=model_override or get_model(),
        )
        db.session.add(conversation)
        db.session.commit()

    # Track whether this is the first message (for title generation)
    is_first_message = not any(m.role == 'user' for m in conversation.messages)

    # Save user message to DB
    user_msg = Message(
        conversation_id=conversation.id,
        role='user',
        content=user_message,
    )
    db.session.add(user_msg)
    db.session.commit()

    # Determine model to use
    model = model_override or conversation.model or get_model()

    # Build message history for the API call
    messages = _build_message_history(conversation)

    # Build system prompt with context
    system_prompt = get_system_prompt()
    context = build_system_context()
    full_system = f"{system_prompt}\n\n{context}"

    # Stream the response
    def generate():
        import anthropic

        client = anthropic.Anthropic(api_key=api_key)
        tools = get_tool_definitions()

        try:
            # We need to handle tool use in a loop — Claude may request
            # multiple tool calls before producing a final text response
            current_messages = list(messages)
            full_response_text = ""
            all_tool_calls = []
            total_input_tokens = 0
            total_output_tokens = 0

            while True:
                # Create a streaming message
                with client.messages.stream(
                    model=model,
                    max_tokens=4096,
                    system=full_system,
                    messages=current_messages,
                    tools=tools,
                ) as stream:
                    # Accumulate the response to check for tool use
                    response_text = ""
                    tool_use_blocks = []
                    current_tool_use = None

                    for event in stream:
                        if event.type == 'content_block_start':
                            if event.content_block.type == 'tool_use':
                                current_tool_use = {
                                    'id': event.content_block.id,
                                    'name': event.content_block.name,
                                    'input_json': '',
                                }
                                # Notify the frontend that a tool is being called
                                yield f"data: {json.dumps({'type': 'tool_use', 'tool': event.content_block.name})}\n\n"
                            else:
                                current_tool_use = None

                        elif event.type == 'content_block_delta':
                            if hasattr(event.delta, 'text'):
                                response_text += event.delta.text
                                yield f"data: {json.dumps({'type': 'text_delta', 'text': event.delta.text})}\n\n"
                            elif hasattr(event.delta, 'partial_json'):
                                if current_tool_use is not None:
                                    current_tool_use['input_json'] += event.delta.partial_json

                        elif event.type == 'content_block_stop':
                            if current_tool_use is not None:
                                # Parse the accumulated JSON input
                                try:
                                    tool_input = json.loads(current_tool_use['input_json']) if current_tool_use['input_json'] else {}
                                except json.JSONDecodeError:
                                    tool_input = {}
                                current_tool_use['input'] = tool_input
                                tool_use_blocks.append(current_tool_use)
                                current_tool_use = None

                    # Get final message for token counts
                    final_message = stream.get_final_message()
                    total_input_tokens += final_message.usage.input_tokens
                    total_output_tokens += final_message.usage.output_tokens

                # If there were tool uses, execute them and continue the loop
                if tool_use_blocks:
                    # Build the assistant message content blocks
                    assistant_content = []
                    if response_text:
                        assistant_content.append({"type": "text", "text": response_text})
                    for tu in tool_use_blocks:
                        assistant_content.append({
                            "type": "tool_use",
                            "id": tu['id'],
                            "name": tu['name'],
                            "input": tu['input'],
                        })
                        all_tool_calls.append({
                            'name': tu['name'],
                            'input': tu['input'],
                        })

                    # Add assistant message to conversation
                    current_messages.append({
                        "role": "assistant",
                        "content": assistant_content,
                    })

                    # Execute each tool and build tool_result messages
                    tool_results = []
                    for tu in tool_use_blocks:
                        result = execute_tool(tu['name'], tu['input'])
                        result_str = json.dumps(result, default=str)

                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": tu['id'],
                            "content": result_str,
                        })

                        # Notify frontend of tool result
                        yield f"data: {json.dumps({'type': 'tool_result', 'tool': tu['name']})}\n\n"

                    current_messages.append({
                        "role": "user",
                        "content": tool_results,
                    })

                    full_response_text += response_text
                    # Add paragraph break so post-tool text doesn't run into pre-tool text
                    if response_text:
                        full_response_text += "\n\n"
                        yield f"data: {json.dumps({'type': 'text_delta', 'text': '\n\n'})}\n\n"
                    tool_use_blocks = []
                    # Continue the loop to get Claude's response after tool results
                else:
                    # No tool use — we're done
                    full_response_text += response_text
                    break

            # Save assistant message to DB
            assistant_msg = Message(
                conversation_id=conversation.id,
                role='assistant',
                content=full_response_text,
                tool_calls=json.dumps(all_tool_calls) if all_tool_calls else None,
                token_count=total_input_tokens + total_output_tokens,
            )
            db.session.add(assistant_msg)
            db.session.commit()

            # Generate a concise title after first exchange
            if is_first_message:
                try:
                    title_response = client.messages.create(
                        model='claude-haiku-4-20250414',
                        max_tokens=30,
                        messages=[{
                            "role": "user",
                            "content": f"Generate a 3-5 word title summarizing this conversation. Reply with ONLY the title, no quotes or punctuation.\n\nUser: {user_message[:200]}\nAssistant: {full_response_text[:200]}"
                        }],
                    )
                    short_title = title_response.content[0].text.strip()[:50]
                    if short_title:
                        conversation.title = short_title
                        db.session.commit()
                except Exception:
                    pass  # Keep the fallback truncated title

            # Send completion event with the (possibly updated) title
            yield f"data: {json.dumps({'type': 'message_stop', 'conversation_id': conversation.id, 'title': conversation.title, 'token_count': total_input_tokens + total_output_tokens})}\n\n"

        except Exception as e:
            error_msg = str(e)
            yield f"data: {json.dumps({'type': 'error', 'error': error_msg})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
        }
    )


def _build_message_history(conversation):
    """
    Build the messages array for the Anthropic API from conversation history.

    Converts stored messages into the format expected by the API.
    Only includes user and assistant messages (not system).
    """
    messages = []
    for msg in conversation.messages:
        if msg.role in ('user', 'assistant'):
            messages.append({
                "role": msg.role,
                "content": msg.content,
            })
    return messages
