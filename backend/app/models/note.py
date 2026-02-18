"""
Notes Module - Database Models

Comprehensive note-taking system with WYSIWYG editing (TipTap),
folder organization, tagging, favorites, and soft-delete trash.

Content is stored as TipTap JSON (JSONB) with a denormalized
plain-text column for full-text search.
"""
from datetime import datetime, timezone
from sqlalchemy.dialects.postgresql import JSONB
from app import db
from app.models.tag import note_tags


class Note(db.Model):
    """A rich-text note with folder organization and tagging."""
    __tablename__ = 'notes'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(500), nullable=False, default='Untitled')

    # TipTap editor content stored as JSON document
    content_json = db.Column(JSONB, nullable=True)

    # Plain-text extraction of content_json for full-text search
    # Populated automatically on every save via extract_text_from_tiptap()
    content_text = db.Column(db.Text, nullable=True)

    # Organization
    folder_id = db.Column(db.Integer, db.ForeignKey('folders.id'), nullable=True)
    is_starred = db.Column(db.Boolean, default=False)

    # Soft delete
    is_trashed = db.Column(db.Boolean, default=False)
    trashed_at = db.Column(db.DateTime, nullable=True)

    # Timestamps
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Many-to-many relationship with tags
    tags = db.relationship('Tag', secondary=note_tags, backref='notes', lazy='joined')

    # One-to-many with attachment associations
    attachments = db.relationship(
        'NoteAttachment', backref='note',
        cascade='all, delete-orphan'
    )

    __table_args__ = (
        db.Index('ix_notes_folder_id', 'folder_id'),
        db.Index('ix_notes_is_trashed', 'is_trashed'),
        db.Index('ix_notes_is_starred', 'is_starred'),
        db.Index('ix_notes_updated_at', 'updated_at'),
    )

    def to_dict(self, include_content=True):
        """
        Convert to dictionary for JSON responses.

        Args:
            include_content: If False, omits content_json for list views
                           where only title/metadata are needed.
        """
        result = {
            'id': self.id,
            'title': self.title,
            'folder_id': self.folder_id,
            'is_starred': self.is_starred,
            'is_trashed': self.is_trashed,
            'trashed_at': self.trashed_at.isoformat() if self.trashed_at else None,
            'tags': [t.to_dict() for t in self.tags],
            'content_text': self.content_text,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

        if include_content:
            result['content_json'] = self.content_json
            result['attachments'] = [a.to_dict() for a in self.attachments]

        return result
