"""
Tags Module - Database Models

First-class tag system for notes with optional colors.
Uses a proper many-to-many relationship via the note_tags
association table instead of CSV strings.
"""
from datetime import datetime, timezone
from app import db


# Association table linking notes to tags (many-to-many)
note_tags = db.Table(
    'note_tags',
    db.Column('note_id', db.Integer, db.ForeignKey('notes.id', ondelete='CASCADE'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('tags.id', ondelete='CASCADE'), primary_key=True),
)


class Tag(db.Model):
    """A reusable tag that can be applied to multiple notes."""
    __tablename__ = 'tags'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    color = db.Column(db.String(7), nullable=True)  # Hex color, e.g. "#89b4fa"
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.Index('ix_tags_name', 'name'),
    )

    def to_dict(self, include_note_count=False):
        """Convert to dictionary for JSON responses."""
        result = {
            'id': self.id,
            'name': self.name,
            'color': self.color,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_note_count:
            # Count non-trashed notes that have this tag
            from app.models.note import Note
            result['note_count'] = (
                Note.query
                .filter(Note.tags.any(Tag.id == self.id))
                .filter_by(is_trashed=False)
                .count()
            )
        return result
