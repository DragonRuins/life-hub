"""
Notes Module - API Routes

CRUD for notes with search, category filtering, and pinning.

Endpoints:
    GET    /api/notes/              → List notes (with optional filters)
    POST   /api/notes/              → Create a note
    GET    /api/notes/<id>          → Get a single note
    PUT    /api/notes/<id>          → Update a note
    DELETE /api/notes/<id>          → Delete a note
    GET    /api/notes/categories    → List all categories in use
"""
from flask import Blueprint, request, jsonify
from app import db
from app.models.note import Note

notes_bp = Blueprint('notes', __name__)


@notes_bp.route('/', methods=['GET'])
def list_notes():
    """
    List notes with optional filtering.

    Query parameters:
        ?category=personal      → Filter by category
        ?search=recipe          → Search title and content
        ?pinned=true            → Only pinned notes
    """
    query = Note.query

    # Filter by category
    category = request.args.get('category')
    if category:
        query = query.filter_by(category=category)

    # Filter pinned only
    if request.args.get('pinned') == 'true':
        query = query.filter_by(is_pinned=True)

    # Search in title and content
    search = request.args.get('search')
    if search:
        search_term = f'%{search}%'
        query = query.filter(
            db.or_(
                Note.title.ilike(search_term),
                Note.content.ilike(search_term),
                Note.tags.ilike(search_term),
            )
        )

    # Pinned notes first, then by most recently updated
    notes = query.order_by(Note.is_pinned.desc(), Note.updated_at.desc()).all()
    return jsonify([n.to_dict() for n in notes])


@notes_bp.route('/', methods=['POST'])
def create_note():
    """
    Create a new note.
    Expects JSON like:
    {
        "title": "Shopping List",
        "content": "Milk, eggs, bread",
        "category": "personal",
        "tags": "shopping,groceries"
    }
    """
    data = request.get_json()

    if not all(k in data for k in ('title', 'content')):
        return jsonify({'error': 'title and content are required'}), 400

    # Tags can be sent as a list or comma-separated string
    tags = data.get('tags', '')
    if isinstance(tags, list):
        tags = ','.join(tags)

    note = Note(
        title=data['title'],
        content=data['content'],
        category=data.get('category', 'general'),
        tags=tags,
        is_pinned=data.get('is_pinned', False),
    )
    db.session.add(note)
    db.session.commit()

    return jsonify(note.to_dict()), 201


@notes_bp.route('/<int:note_id>', methods=['GET'])
def get_note(note_id):
    """Get a single note."""
    note = Note.query.get_or_404(note_id)
    return jsonify(note.to_dict())


@notes_bp.route('/<int:note_id>', methods=['PUT'])
def update_note(note_id):
    """Update a note."""
    note = Note.query.get_or_404(note_id)
    data = request.get_json()

    for field in ('title', 'content', 'category', 'is_pinned'):
        if field in data:
            setattr(note, field, data[field])

    if 'tags' in data:
        tags = data['tags']
        if isinstance(tags, list):
            tags = ','.join(tags)
        note.tags = tags

    db.session.commit()
    return jsonify(note.to_dict())


@notes_bp.route('/<int:note_id>', methods=['DELETE'])
def delete_note(note_id):
    """Delete a note."""
    note = Note.query.get_or_404(note_id)
    db.session.delete(note)
    db.session.commit()
    return jsonify({'message': 'Note deleted'}), 200


@notes_bp.route('/categories', methods=['GET'])
def list_categories():
    """Get all categories currently in use (for filter dropdowns)."""
    categories = (
        db.session.query(Note.category)
        .distinct()
        .order_by(Note.category)
        .all()
    )
    return jsonify([c[0] for c in categories])
