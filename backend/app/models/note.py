"""
Notes Module - Database Models

A simple but flexible notes system with tagging support.
Tags are stored as a comma-separated string for simplicity.
If you later need complex tag queries, we can add a proper
many-to-many relationship with a tags table.
"""
from datetime import datetime, timezone
from app import db


class Note(db.Model):
    """A note or piece of information you want to save."""
    __tablename__ = 'notes'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(300), nullable=False)
    content = db.Column(db.Text, nullable=False)           # The actual note body
    category = db.Column(db.String(100), default='general') # e.g., "personal", "work", "reference"
    tags = db.Column(db.String(500))                        # Comma-separated: "recipe,dinner,quick"
    is_pinned = db.Column(db.Boolean, default=False)        # Pin important notes to top
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'category': self.category,
            'tags': self.tags.split(',') if self.tags else [],
            'is_pinned': self.is_pinned,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
