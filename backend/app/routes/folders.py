"""
Folders Module - API Routes

Hierarchical folder management for organizing notes.
Supports up to 3 levels of nesting.

Endpoints:
    GET    /api/folders/              → Get full folder tree
    POST   /api/folders/              → Create a folder
    PUT    /api/folders/<id>          → Rename or move a folder
    DELETE /api/folders/<id>          → Delete a folder
    PUT    /api/folders/<id>/reorder  → Reorder within parent
"""
from flask import Blueprint, request, jsonify
from app import db
from app.models.folder import Folder
from app.models.note import Note

folders_bp = Blueprint('folders', __name__)

MAX_FOLDER_DEPTH = 3


def _get_depth(folder_id):
    """
    Count how many levels deep a folder is (root = depth 1).
    Returns 0 if folder_id is None (creating at root level).
    """
    if folder_id is None:
        return 0
    depth = 0
    current = Folder.query.get(folder_id)
    while current:
        depth += 1
        current = current.parent
    return depth


@folders_bp.route('/', methods=['GET'])
def list_folders():
    """
    Get the full folder tree.

    Returns a nested array of folders, each with children
    and a note_count field showing non-trashed notes in that folder.
    """
    # Get only root-level folders; children are eager-loaded via relationship
    root_folders = (
        Folder.query
        .filter(Folder.parent_id.is_(None))
        .order_by(Folder.position, Folder.name)
        .all()
    )
    return jsonify([f.to_dict() for f in root_folders])


@folders_bp.route('/', methods=['POST'])
def create_folder():
    """
    Create a new folder.

    Expects JSON:
    { "name": "Work Notes", "parent_id": 1 }

    parent_id is optional (null = root folder).
    Validates that nesting doesn't exceed 3 levels.
    """
    data = request.get_json()
    name = data.get('name', '').strip()

    if not name:
        return jsonify({'error': 'Folder name is required'}), 400

    parent_id = data.get('parent_id')

    # Validate max depth: parent's depth + 1 for the new folder
    if parent_id is not None:
        parent = Folder.query.get(parent_id)
        if not parent:
            return jsonify({'error': 'Parent folder not found'}), 404

        parent_depth = parent.get_depth()
        if parent_depth >= MAX_FOLDER_DEPTH:
            return jsonify({
                'error': f'Maximum folder depth of {MAX_FOLDER_DEPTH} reached'
            }), 400

    # Set position to end of sibling list
    max_position = db.session.query(db.func.max(Folder.position)).filter(
        Folder.parent_id == parent_id
    ).scalar() or 0

    folder = Folder(
        name=name,
        parent_id=parent_id,
        position=max_position + 1,
    )
    db.session.add(folder)
    db.session.commit()
    return jsonify(folder.to_dict()), 201


@folders_bp.route('/<int:folder_id>', methods=['PUT'])
def update_folder(folder_id):
    """
    Rename or move a folder.

    Expects JSON:
    { "name": "New Name", "parent_id": 2 }

    When moving, validates that the new depth doesn't exceed 3 levels
    and prevents circular references.
    """
    folder = Folder.query.get_or_404(folder_id)
    data = request.get_json()

    if 'name' in data:
        name = data['name'].strip()
        if not name:
            return jsonify({'error': 'Folder name is required'}), 400
        folder.name = name

    if 'parent_id' in data:
        new_parent_id = data['parent_id']

        # Prevent moving a folder into itself
        if new_parent_id == folder_id:
            return jsonify({'error': 'Cannot move folder into itself'}), 400

        # Prevent circular references (moving into a descendant)
        if new_parent_id is not None:
            current = Folder.query.get(new_parent_id)
            while current:
                if current.id == folder_id:
                    return jsonify({'error': 'Cannot move folder into a descendant'}), 400
                current = current.parent

            # Validate max depth after move
            new_parent_depth = _get_depth(new_parent_id)
            # Calculate how deep this folder's subtree goes
            max_subtree_depth = _max_subtree_depth(folder)
            if new_parent_depth + max_subtree_depth > MAX_FOLDER_DEPTH:
                return jsonify({
                    'error': f'Move would exceed maximum folder depth of {MAX_FOLDER_DEPTH}'
                }), 400

        folder.parent_id = new_parent_id

    db.session.commit()
    return jsonify(folder.to_dict())


def _max_subtree_depth(folder):
    """Calculate the maximum depth of a folder's subtree (including itself)."""
    if not folder.children:
        return 1
    return 1 + max(_max_subtree_depth(child) for child in folder.children)


@folders_bp.route('/<int:folder_id>', methods=['DELETE'])
def delete_folder(folder_id):
    """
    Delete a folder and its sub-folders.

    Query parameters:
        ?action=move_to_root   → (default) Move notes to root level
        ?action=trash_notes    → Move notes to trash

    Sub-folders are always recursively deleted.
    Returns the count of affected notes.
    """
    folder = Folder.query.get_or_404(folder_id)
    action = request.args.get('action', 'move_to_root')

    # Collect all folder IDs in the subtree (including this folder)
    folder_ids = _collect_folder_ids(folder)

    # Count and handle notes in all affected folders
    affected_notes = Note.query.filter(Note.folder_id.in_(folder_ids)).all()
    note_count = len(affected_notes)

    if action == 'trash_notes':
        from datetime import datetime, timezone
        for note in affected_notes:
            note.is_trashed = True
            note.trashed_at = datetime.now(timezone.utc)
            note.folder_id = None
    else:
        # Default: move notes to root
        for note in affected_notes:
            note.folder_id = None

    # Delete the folder tree (cascade handles sub-folders)
    db.session.delete(folder)
    db.session.commit()

    return jsonify({
        'message': 'Folder deleted',
        'notes_affected': note_count,
        'action': action,
    }), 200


def _collect_folder_ids(folder):
    """Recursively collect all folder IDs in a subtree."""
    ids = [folder.id]
    for child in folder.children:
        ids.extend(_collect_folder_ids(child))
    return ids


@folders_bp.route('/<int:folder_id>/reorder', methods=['PUT'])
def reorder_folder(folder_id):
    """
    Reorder a folder within its parent.

    Expects JSON:
    { "position": 2 }
    """
    folder = Folder.query.get_or_404(folder_id)
    data = request.get_json()
    new_position = data.get('position')

    if new_position is None:
        return jsonify({'error': 'Position is required'}), 400

    # Get all siblings, sorted by current position
    siblings = (
        Folder.query
        .filter(Folder.parent_id == folder.parent_id, Folder.id != folder.id)
        .order_by(Folder.position)
        .all()
    )

    # Insert this folder at the new position
    siblings.insert(min(new_position, len(siblings)), folder)

    # Reassign sequential positions
    for i, sibling in enumerate(siblings):
        sibling.position = i

    db.session.commit()
    return jsonify(folder.to_dict(include_children=False))
