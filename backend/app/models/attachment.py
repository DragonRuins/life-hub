"""
Attachments Module - Database Models

Global media library for file attachments (images, documents).
Attachments exist independently of notes and can be reused
across multiple notes via the NoteAttachment join table.

Files are stored on disk using UUID-based filenames to avoid
collisions. The original filename is preserved in the database.
"""
from datetime import datetime, timezone
from app import db


class Attachment(db.Model):
    """A file in the global media library."""
    __tablename__ = 'attachments'

    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(500), nullable=False)         # Original filename
    stored_filename = db.Column(db.String(500), nullable=False)  # UUID-based name on disk
    mime_type = db.Column(db.String(200), nullable=False)
    size_bytes = db.Column(db.Integer, nullable=False)
    uploaded_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationship to notes through the join table
    note_attachments = db.relationship(
        'NoteAttachment', backref='attachment',
        cascade='all, delete-orphan'
    )

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'filename': self.filename,
            'stored_filename': self.stored_filename,
            'mime_type': self.mime_type,
            'size_bytes': self.size_bytes,
            'url': f'/api/attachments/{self.id}/file',
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None,
        }


class NoteAttachment(db.Model):
    """Association between a note and an attachment (many-to-many with metadata)."""
    __tablename__ = 'note_attachments'

    id = db.Column(db.Integer, primary_key=True)
    note_id = db.Column(
        db.Integer, db.ForeignKey('notes.id', ondelete='CASCADE'), nullable=False
    )
    attachment_id = db.Column(
        db.Integer, db.ForeignKey('attachments.id', ondelete='CASCADE'), nullable=False
    )
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.UniqueConstraint('note_id', 'attachment_id', name='uq_note_attachment'),
        db.Index('ix_note_attachments_note_id', 'note_id'),
        db.Index('ix_note_attachments_attachment_id', 'attachment_id'),
    )

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'note_id': self.note_id,
            'attachment_id': self.attachment_id,
            'attachment': self.attachment.to_dict() if self.attachment else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
