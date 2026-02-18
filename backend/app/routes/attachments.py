"""
Attachments Module - API Routes

Global media library for file uploads. Attachments exist independently
of notes and can be reused across multiple notes.

Files are stored on disk using UUID-based filenames. The original
filename is preserved in the database for display purposes.

Endpoints:
    POST   /api/attachments/upload       → Upload a file
    GET    /api/attachments/             → List all attachments
    GET    /api/attachments/<id>         → Get attachment metadata
    GET    /api/attachments/<id>/file    → Serve the actual file
    DELETE /api/attachments/<id>         → Delete an attachment
"""
import os
import uuid

from flask import Blueprint, request, jsonify, current_app, send_from_directory
from app import db
from app.models.attachment import Attachment, NoteAttachment

attachments_bp = Blueprint('attachments', __name__)


@attachments_bp.route('/upload', methods=['POST'])
def upload_file():
    """
    Upload a file to the global media library.

    Expects: multipart/form-data with a 'file' field.
    Optionally accepts 'note_id' to immediately link the attachment to a note.

    Returns the attachment metadata including its serving URL.
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '' or file.filename is None:
        return jsonify({'error': 'No file selected'}), 400

    # Validate file extension
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    allowed = current_app.config.get('ALLOWED_EXTENSIONS', set())
    if ext not in allowed:
        return jsonify({'error': f'File type .{ext} not allowed'}), 400

    # Generate a UUID-based filename to avoid collisions
    stored_name = f"{uuid.uuid4().hex}.{ext}"
    upload_dir = current_app.config['UPLOAD_DIR']
    os.makedirs(upload_dir, exist_ok=True)

    # Save file to disk
    file_path = os.path.join(upload_dir, stored_name)
    file.save(file_path)
    size = os.path.getsize(file_path)

    # Create database record
    attachment = Attachment(
        filename=file.filename,
        stored_filename=stored_name,
        mime_type=file.content_type or 'application/octet-stream',
        size_bytes=size,
    )
    db.session.add(attachment)
    db.session.flush()  # Get the ID before committing

    # Optionally link to a note immediately
    note_id = request.form.get('note_id')
    if note_id:
        try:
            note_attachment = NoteAttachment(
                note_id=int(note_id),
                attachment_id=attachment.id,
            )
            db.session.add(note_attachment)
        except (ValueError, TypeError):
            pass  # Invalid note_id, skip linking

    db.session.commit()
    return jsonify(attachment.to_dict()), 201


@attachments_bp.route('/', methods=['GET'])
def list_attachments():
    """
    List all attachments in the global media library.

    Query parameters:
        ?search=filename    → Search by original filename
        ?mime_type=image    → Filter by MIME type prefix (e.g., "image" matches image/*)
    """
    query = Attachment.query

    # Search by filename
    search = request.args.get('search')
    if search:
        query = query.filter(Attachment.filename.ilike(f'%{search}%'))

    # Filter by MIME type prefix
    mime_type = request.args.get('mime_type')
    if mime_type:
        query = query.filter(Attachment.mime_type.ilike(f'{mime_type}%'))

    attachments = query.order_by(Attachment.uploaded_at.desc()).all()
    return jsonify([a.to_dict() for a in attachments])


@attachments_bp.route('/<int:attachment_id>', methods=['GET'])
def get_attachment(attachment_id):
    """Get attachment metadata."""
    attachment = Attachment.query.get_or_404(attachment_id)
    return jsonify(attachment.to_dict())


@attachments_bp.route('/<int:attachment_id>/file', methods=['GET'])
def serve_file(attachment_id):
    """
    Serve the actual file for display or download.
    Images are served inline; other files prompt download.
    """
    attachment = Attachment.query.get_or_404(attachment_id)
    upload_dir = current_app.config['UPLOAD_DIR']

    # Determine if the file should be displayed inline or downloaded
    is_image = attachment.mime_type.startswith('image/')
    as_attachment = not is_image

    return send_from_directory(
        upload_dir,
        attachment.stored_filename,
        mimetype=attachment.mime_type,
        as_attachment=as_attachment,
        download_name=attachment.filename,
    )


@attachments_bp.route('/<int:attachment_id>', methods=['DELETE'])
def delete_attachment(attachment_id):
    """
    Delete an attachment from the media library.

    If the attachment is referenced by notes and ?force=true is not set,
    returns a 409 Conflict with the usage count. With ?force=true, it
    removes all note references and deletes the file.
    """
    attachment = Attachment.query.get_or_404(attachment_id)
    force = request.args.get('force') == 'true'

    # Check if the attachment is used by any notes
    usage_count = NoteAttachment.query.filter_by(attachment_id=attachment_id).count()

    if usage_count > 0 and not force:
        return jsonify({
            'error': 'Attachment is in use by notes',
            'in_use': True,
            'note_count': usage_count,
        }), 409

    # Delete the file from disk
    upload_dir = current_app.config['UPLOAD_DIR']
    file_path = os.path.join(upload_dir, attachment.stored_filename)
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
    except OSError:
        pass  # File might already be gone; don't block the DB cleanup

    # Delete the database record (cascades to note_attachments)
    db.session.delete(attachment)
    db.session.commit()

    return jsonify({'message': 'Attachment deleted'}), 200
