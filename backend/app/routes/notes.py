"""
Notes Module - API Routes

Comprehensive notes system with WYSIWYG content, folder organization,
tagging, favorites, soft-delete trash, and full-text search.

Endpoints:
    GET    /api/notes/                → List notes (with filters)
    POST   /api/notes/                → Create a note
    GET    /api/notes/<id>            → Get a single note
    PUT    /api/notes/<id>            → Update a note (auto-save target)
    DELETE /api/notes/<id>            → Soft delete (trash)
    PUT    /api/notes/<id>/restore    → Restore from trash
    DELETE /api/notes/<id>/permanent  → Permanently delete
    POST   /api/notes/empty-trash     → Empty all trash
    POST   /api/notes/<id>/move       → Move to folder
    GET    /api/notes/recent          → Recent notes
    GET    /api/notes/stats           → Stats for dashboard

    GET    /api/notes/tags            → List all tags
    POST   /api/notes/tags            → Create a tag
    PUT    /api/notes/tags/<id>       → Update a tag
    DELETE /api/notes/tags/<id>       → Delete a tag
"""
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify
from app import db
from app.models.note import Note
from app.models.tag import Tag, note_tags
from app.models.attachment import NoteAttachment
from app.utils import extract_text_from_tiptap
from app.services.event_bus import emit

notes_bp = Blueprint('notes', __name__)


# ── Notes CRUD ──────────────────────────────────────────────────


@notes_bp.route('/', methods=['GET'])
def list_notes():
    """
    List notes with optional filtering and sorting.

    Query parameters:
        ?folder_id=3       → Notes in a specific folder
        ?search=keyword    → Search title and content_text
        ?starred=true      → Only starred notes
        ?trashed=true      → Only trashed notes (default: non-trashed)
        ?tag=tagname       → Notes with a specific tag
        ?sort=updated_at   → Sort field (updated_at, created_at, title)
        ?order=desc        → Sort order (asc, desc)
    """
    query = Note.query

    # By default, exclude trashed notes unless explicitly requested
    if request.args.get('trashed') == 'true':
        query = query.filter(Note.is_trashed == True)  # noqa: E712
    else:
        query = query.filter(Note.is_trashed == False)  # noqa: E712

    # Filter by folder
    folder_id = request.args.get('folder_id')
    if folder_id is not None:
        if folder_id == 'null' or folder_id == '':
            # Notes at root level (no folder)
            query = query.filter(Note.folder_id.is_(None))
        else:
            query = query.filter(Note.folder_id == int(folder_id))

    # Filter starred only
    if request.args.get('starred') == 'true':
        query = query.filter(Note.is_starred == True)  # noqa: E712

    # Filter by tag name
    tag_name = request.args.get('tag')
    if tag_name:
        query = query.filter(Note.tags.any(Tag.name == tag_name))

    # Full-text search in title and content_text
    search = request.args.get('search')
    if search:
        search_term = f'%{search}%'
        query = query.filter(
            db.or_(
                Note.title.ilike(search_term),
                Note.content_text.ilike(search_term),
            )
        )

    # Sorting
    sort_field = request.args.get('sort', 'updated_at')
    sort_order = request.args.get('order', 'desc')

    sort_column = {
        'updated_at': Note.updated_at,
        'created_at': Note.created_at,
        'title': Note.title,
    }.get(sort_field, Note.updated_at)

    if sort_order == 'asc':
        query = query.order_by(Note.is_starred.desc(), sort_column.asc())
    else:
        query = query.order_by(Note.is_starred.desc(), sort_column.desc())

    notes = query.all()
    return jsonify([n.to_dict(include_content=False) for n in notes])


@notes_bp.route('/', methods=['POST'])
def create_note():
    """
    Create a new note.

    Expects JSON:
    {
        "title": "My Note",
        "content_json": { ... TipTap JSON ... },
        "folder_id": 1,          // optional
        "tag_ids": [1, 2, 3]     // optional
    }
    """
    data = request.get_json()

    title = data.get('title', 'Untitled').strip() or 'Untitled'
    content_json = data.get('content_json')
    content_text = extract_text_from_tiptap(content_json)

    note = Note(
        title=title,
        content_json=content_json,
        content_text=content_text,
        folder_id=data.get('folder_id'),
        is_starred=data.get('is_starred', False),
    )

    # Attach tags by ID
    tag_ids = data.get('tag_ids', [])
    if tag_ids:
        tags = Tag.query.filter(Tag.id.in_(tag_ids)).all()
        note.tags = tags

    db.session.add(note)
    db.session.commit()

    # Emit notification event
    try:
        tag_names = ','.join(t.name for t in note.tags)
        emit('note.created', title=note.title, tags=tag_names)
    except Exception:
        pass  # Never let notifications break note creation

    return jsonify(note.to_dict()), 201


@notes_bp.route('/<int:note_id>', methods=['GET'])
def get_note(note_id):
    """Get a single note with full content, tags, and attachments."""
    note = Note.query.get_or_404(note_id)
    return jsonify(note.to_dict())


@notes_bp.route('/<int:note_id>', methods=['PUT'])
def update_note(note_id):
    """
    Update a note. Supports partial updates (auto-save target).

    Only fields present in the request body are updated.
    When content_json is updated, content_text is automatically
    recalculated for search indexing.
    """
    note = Note.query.get_or_404(note_id)
    data = request.get_json()

    # Update simple fields if present
    if 'title' in data:
        note.title = data['title'].strip() or 'Untitled'

    if 'content_json' in data:
        note.content_json = data['content_json']
        note.content_text = extract_text_from_tiptap(data['content_json'])

    if 'folder_id' in data:
        note.folder_id = data['folder_id']

    if 'is_starred' in data:
        was_starred = note.is_starred
        note.is_starred = data['is_starred']

        # Emit notification when starring a note
        if not was_starred and data['is_starred']:
            try:
                emit('note.starred', title=note.title)
            except Exception:
                pass

    # Update tags if provided
    if 'tag_ids' in data:
        tags = Tag.query.filter(Tag.id.in_(data['tag_ids'])).all()
        note.tags = tags

    db.session.commit()
    return jsonify(note.to_dict())


@notes_bp.route('/<int:note_id>', methods=['DELETE'])
def trash_note(note_id):
    """
    Soft delete: move note to trash.
    Sets is_trashed=True and records trashed_at timestamp.
    """
    note = Note.query.get_or_404(note_id)
    note.is_trashed = True
    note.trashed_at = datetime.now(timezone.utc)
    db.session.commit()

    # Emit notification event
    try:
        emit('note.trashed', title=note.title)
    except Exception:
        pass

    return jsonify({'message': 'Note moved to trash'}), 200


@notes_bp.route('/<int:note_id>/restore', methods=['PUT'])
def restore_note(note_id):
    """
    Restore a note from trash.
    If the note's folder was deleted while it was trashed,
    it restores to root level (folder_id=None).
    """
    note = Note.query.get_or_404(note_id)

    if not note.is_trashed:
        return jsonify({'error': 'Note is not in trash'}), 400

    note.is_trashed = False
    note.trashed_at = None

    # If the folder no longer exists, move to root
    if note.folder_id is not None:
        from app.models.folder import Folder
        if not Folder.query.get(note.folder_id):
            note.folder_id = None

    db.session.commit()
    return jsonify(note.to_dict())


@notes_bp.route('/<int:note_id>/permanent', methods=['DELETE'])
def permanent_delete_note(note_id):
    """Permanently delete a note from the database."""
    note = Note.query.get_or_404(note_id)
    db.session.delete(note)
    db.session.commit()
    return jsonify({'message': 'Note permanently deleted'}), 200


@notes_bp.route('/empty-trash', methods=['POST'])
def empty_trash():
    """Permanently delete all trashed notes."""
    trashed = Note.query.filter_by(is_trashed=True).all()
    count = len(trashed)
    for note in trashed:
        db.session.delete(note)
    db.session.commit()
    return jsonify({'message': f'{count} notes permanently deleted', 'count': count}), 200


@notes_bp.route('/<int:note_id>/move', methods=['POST'])
def move_note(note_id):
    """
    Move a note to a different folder.

    Expects JSON:
    { "folder_id": 3 }   or   { "folder_id": null }  for root
    """
    note = Note.query.get_or_404(note_id)
    data = request.get_json()
    note.folder_id = data.get('folder_id')
    db.session.commit()
    return jsonify(note.to_dict(include_content=False))


@notes_bp.route('/recent', methods=['GET'])
def recent_notes():
    """
    Get recently updated non-trashed notes.

    Query parameters:
        ?limit=10   → Number of notes to return (default 10)
    """
    limit = request.args.get('limit', 10, type=int)
    notes = (
        Note.query
        .filter_by(is_trashed=False)
        .order_by(Note.updated_at.desc())
        .limit(limit)
        .all()
    )
    return jsonify([n.to_dict(include_content=False) for n in notes])


@notes_bp.route('/stats', methods=['GET'])
def note_stats():
    """
    Stats for the dashboard.

    Returns:
    {
        "total": 42,
        "starred": 5,
        "trashed": 3,
        "recent": [ ... top 5 recent notes ... ]
    }
    """
    total = Note.query.filter_by(is_trashed=False).count()
    starred = Note.query.filter_by(is_trashed=False, is_starred=True).count()
    trashed = Note.query.filter_by(is_trashed=True).count()

    recent = (
        Note.query
        .filter_by(is_trashed=False)
        .order_by(Note.updated_at.desc())
        .limit(5)
        .all()
    )

    return jsonify({
        'total': total,
        'starred': starred,
        'trashed': trashed,
        'recent': [n.to_dict(include_content=False) for n in recent],
    })


# ── Tags CRUD ──────────────────────────────────────────────────


@notes_bp.route('/tags', methods=['GET'])
def list_tags():
    """List all tags with note counts."""
    tags = Tag.query.order_by(Tag.name).all()
    return jsonify([t.to_dict(include_note_count=True) for t in tags])


@notes_bp.route('/tags', methods=['POST'])
def create_tag():
    """
    Create a new tag.

    Expects JSON:
    { "name": "important", "color": "#89b4fa" }
    """
    data = request.get_json()
    name = data.get('name', '').strip()

    if not name:
        return jsonify({'error': 'Tag name is required'}), 400

    # Check for duplicate
    existing = Tag.query.filter(db.func.lower(Tag.name) == name.lower()).first()
    if existing:
        return jsonify({'error': 'Tag already exists', 'tag': existing.to_dict()}), 409

    tag = Tag(
        name=name,
        color=data.get('color'),
    )
    db.session.add(tag)
    db.session.commit()
    return jsonify(tag.to_dict(include_note_count=True)), 201


@notes_bp.route('/tags/<int:tag_id>', methods=['PUT'])
def update_tag(tag_id):
    """Update a tag's name or color."""
    tag = Tag.query.get_or_404(tag_id)
    data = request.get_json()

    if 'name' in data:
        name = data['name'].strip()
        if not name:
            return jsonify({'error': 'Tag name is required'}), 400

        # Check for duplicate (excluding self)
        existing = Tag.query.filter(
            db.func.lower(Tag.name) == name.lower(),
            Tag.id != tag_id
        ).first()
        if existing:
            return jsonify({'error': 'Tag name already in use'}), 409

        tag.name = name

    if 'color' in data:
        tag.color = data['color']

    db.session.commit()
    return jsonify(tag.to_dict(include_note_count=True))


@notes_bp.route('/tags/<int:tag_id>', methods=['DELETE'])
def delete_tag(tag_id):
    """
    Delete a tag. Removes it from all notes but does not delete the notes.
    """
    tag = Tag.query.get_or_404(tag_id)
    db.session.delete(tag)
    db.session.commit()
    return jsonify({'message': 'Tag deleted'}), 200
