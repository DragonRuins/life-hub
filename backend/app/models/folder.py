"""
Folders Module - Database Models

Hierarchical folder system for organizing notes.
Supports up to 3 levels of nesting (enforced at the API layer).
"""
from datetime import datetime, timezone
from app import db


class Folder(db.Model):
    """A folder that can contain notes and sub-folders."""
    __tablename__ = 'folders'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('folders.id'), nullable=True)
    position = db.Column(db.Integer, default=0)  # Sort order within parent
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Self-referential relationship for nested folders
    children = db.relationship(
        'Folder',
        backref=db.backref('parent', remote_side='Folder.id'),
        cascade='all, delete-orphan',
        lazy='joined',
        order_by='Folder.position'
    )

    # Notes in this folder (lazy='dynamic' so we can query/count efficiently)
    notes = db.relationship('Note', backref='folder', lazy='dynamic')

    __table_args__ = (
        db.Index('ix_folders_parent_id', 'parent_id'),
    )

    def get_depth(self):
        """
        Count how many levels above this folder (root = depth 1).
        Used to enforce max nesting depth.
        """
        depth = 1
        current = self.parent
        while current:
            depth += 1
            current = current.parent
        return depth

    def to_dict(self, include_children=True):
        """Convert to dictionary for JSON responses."""
        result = {
            'id': self.id,
            'name': self.name,
            'parent_id': self.parent_id,
            'position': self.position,
            'note_count': self.notes.filter_by(is_trashed=False).count(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_children:
            result['children'] = [c.to_dict(include_children=True) for c in self.children]
        return result
