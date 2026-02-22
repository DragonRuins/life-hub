"""
AI Chat Module - Database Models

Three tables for the AI assistant feature:
  - ai_conversations: Chat threads/sessions
  - ai_messages: Individual messages within conversations
  - ai_settings: Single-row config for model, system prompt, etc.

The AI assistant uses Claude (Anthropic API) with tool_use to query
application data read-only. Conversations and messages are persisted
so users can revisit past interactions.
"""
from datetime import datetime, timezone
from app import db


class Conversation(db.Model):
    """A chat conversation/thread with the AI assistant."""
    __tablename__ = 'ai_conversations'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=True)       # Auto-generated from first message
    model = db.Column(db.String(100), nullable=True)       # Which Claude model was used
    system_prompt = db.Column(db.Text, nullable=True)      # Custom prompt override for this conversation
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )
    is_archived = db.Column(db.Boolean, default=False)

    # Relationship: one conversation has many messages
    messages = db.relationship(
        'Message', backref='conversation', cascade='all, delete-orphan',
        order_by='Message.created_at'
    )

    def to_dict(self, include_messages=False):
        """Convert to dictionary for JSON responses."""
        result = {
            'id': self.id,
            'title': self.title,
            'model': self.model,
            'system_prompt': self.system_prompt,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'is_archived': self.is_archived,
            'message_count': len(self.messages),
        }
        if include_messages:
            result['messages'] = [m.to_dict() for m in self.messages]
        return result


class Message(db.Model):
    """A single message in an AI conversation."""
    __tablename__ = 'ai_messages'

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(
        db.Integer,
        db.ForeignKey('ai_conversations.id', ondelete='CASCADE'),
        nullable=False
    )
    role = db.Column(db.String(20), nullable=False)        # 'user', 'assistant', 'system'
    content = db.Column(db.Text, nullable=False)
    tool_calls = db.Column(db.Text, nullable=True)         # Serialized tool_use blocks for audit
    token_count = db.Column(db.Integer, nullable=True)     # For tracking usage
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.Index('ix_ai_messages_conversation_id', 'conversation_id'),
    )

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'conversation_id': self.conversation_id,
            'role': self.role,
            'content': self.content,
            'tool_calls': self.tool_calls,
            'token_count': self.token_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class AISettings(db.Model):
    """Single-row settings for the AI assistant.

    Uses the single-row pattern: only one row ever exists (id=1).
    Stores the user's model preference and custom system prompt.
    """
    __tablename__ = 'ai_settings'

    id = db.Column(db.Integer, primary_key=True)
    model = db.Column(db.String(100), default='claude-sonnet-4-20250514')
    system_prompt = db.Column(db.Text, nullable=True)      # null = use default
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'model': self.model,
            'system_prompt': self.system_prompt,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
