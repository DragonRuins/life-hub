"""
Jumper/Bypass Module - API Routes

CRUD endpoints for tracking PLC jumpers/bypasses across customer sites.

Endpoints:
  Sites:
    GET    /api/jumpers/sites            -> List all sites (with active counts)
    POST   /api/jumpers/sites            -> Create a new site
    GET    /api/jumpers/sites/<id>       -> Site detail (includes CPUs, tags)
    PUT    /api/jumpers/sites/<id>       -> Update a site
    DELETE /api/jumpers/sites/<id>       -> Delete a site

  Jumpers:
    GET    /api/jumpers/sites/<id>/jumpers   -> List jumpers for a site
    POST   /api/jumpers/sites/<id>/jumpers   -> Create a new jumper
    GET    /api/jumpers/<id>                 -> Get single jumper
    PUT    /api/jumpers/<id>                 -> Update a jumper
    PUT    /api/jumpers/<id>/remove          -> Soft-remove a jumper
    DELETE /api/jumpers/<id>                 -> Hard-delete a jumper

  Stats:
    GET    /api/jumpers/stats            -> Aggregate statistics
"""
from datetime import datetime, timedelta, timezone

from flask import Blueprint, request, jsonify

from app import db
from app.models.jumper import JumperSite, JumperCPU, JumperTag, Jumper

jumpers_bp = Blueprint('jumpers', __name__)

# 8-hour reminder threshold for short-term jumpers
REMINDER_HOURS = 8


# ═══════════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════════

def _get_or_create_cpu(site_id, cpu_name):
    """Find an existing CPU by name at this site, or create a new one.

    Args:
        site_id: The site this CPU belongs to.
        cpu_name: The display name for the CPU (e.g., "PLC-01").

    Returns:
        JumperCPU instance (existing or newly created, already in session).
    """
    if not cpu_name or not cpu_name.strip():
        return None
    cpu_name = cpu_name.strip()
    cpu = JumperCPU.query.filter_by(site_id=site_id, name=cpu_name).first()
    if not cpu:
        cpu = JumperCPU(site_id=site_id, name=cpu_name)
        db.session.add(cpu)
        db.session.flush()  # Get the ID without committing
    return cpu


def _get_or_create_tag(site_id, tag_name):
    """Find an existing tag by name at this site, or create a new one.

    Args:
        site_id: The site this tag belongs to.
        tag_name: The display name for the tag (e.g., "WO-2026-001").

    Returns:
        JumperTag instance (existing or newly created, already in session).
    """
    if not tag_name or not tag_name.strip():
        return None
    tag_name = tag_name.strip()
    tag = JumperTag.query.filter_by(site_id=site_id, name=tag_name).first()
    if not tag:
        tag = JumperTag(site_id=site_id, name=tag_name)
        db.session.add(tag)
        db.session.flush()
    return tag


def _schedule_jumper_reminder_safe(jumper_id, fire_at):
    """Schedule an 8-hour reminder notification for a jumper.

    Wraps the scheduler call in try/except so a missing or broken
    scheduler never prevents jumper creation/update from succeeding.
    """
    try:
        from app.services.scheduler import schedule_jumper_reminder
        schedule_jumper_reminder(jumper_id, fire_at)
    except Exception:
        pass


def _cancel_jumper_reminder_safe(jumper_id):
    """Cancel any pending reminder for a jumper.

    Wraps the scheduler call in try/except so a missing or broken
    scheduler never prevents jumper removal/deletion from succeeding.
    """
    try:
        from app.services.scheduler import cancel_jumper_reminder
        cancel_jumper_reminder(jumper_id)
    except Exception:
        pass


def _parse_installed_at(data):
    """Parse an optional installed_at ISO timestamp from request data.

    Handles both 'Z' suffix and '+00:00' offset formats.

    Returns:
        datetime or None if not provided or invalid.
    """
    if data.get('installed_at'):
        try:
            raw = data['installed_at'].replace('Z', '+00:00')
            return datetime.fromisoformat(raw)
        except (ValueError, AttributeError):
            pass
    return None


# ═══════════════════════════════════════════════════════════════════
# Site Endpoints
# ═══════════════════════════════════════════════════════════════════

@jumpers_bp.route('/sites', methods=['GET'])
def list_sites():
    """List all sites, ordered by name. Includes active jumper counts."""
    sites = JumperSite.query.order_by(JumperSite.name).all()
    return jsonify([s.to_dict(include_counts=True) for s in sites])


@jumpers_bp.route('/sites', methods=['POST'])
def create_site():
    """Create a new site.

    Required: name
    Optional: address, contact_name, contact_phone, contact_email, notes
    """
    data = request.get_json() or {}

    if not data.get('name', '').strip():
        return jsonify({'error': 'name is required'}), 400

    site = JumperSite(
        name=data['name'].strip(),
        address=data.get('address'),
        contact_name=data.get('contact_name'),
        contact_phone=data.get('contact_phone'),
        contact_email=data.get('contact_email'),
        notes=data.get('notes'),
    )
    db.session.add(site)
    db.session.commit()

    return jsonify(site.to_dict(include_counts=True)), 201


@jumpers_bp.route('/sites/<int:site_id>', methods=['GET'])
def get_site(site_id):
    """Get full site details including CPUs and tags."""
    site = db.session.get(JumperSite, site_id)
    if not site:
        return jsonify({'error': 'Site not found'}), 404
    return jsonify(site.to_detail_dict())


@jumpers_bp.route('/sites/<int:site_id>', methods=['PUT'])
def update_site(site_id):
    """Update site fields. Only updates fields present in request body."""
    site = db.session.get(JumperSite, site_id)
    if not site:
        return jsonify({'error': 'Site not found'}), 404

    data = request.get_json() or {}

    if 'name' in data:
        if not data['name'].strip():
            return jsonify({'error': 'name cannot be empty'}), 400
        site.name = data['name'].strip()
    if 'address' in data:
        site.address = data['address']
    if 'contact_name' in data:
        site.contact_name = data['contact_name']
    if 'contact_phone' in data:
        site.contact_phone = data['contact_phone']
    if 'contact_email' in data:
        site.contact_email = data['contact_email']
    if 'notes' in data:
        site.notes = data['notes']

    db.session.commit()
    return jsonify(site.to_dict(include_counts=True))


@jumpers_bp.route('/sites/<int:site_id>', methods=['DELETE'])
def delete_site(site_id):
    """Delete a site. Cancels pending reminders for active short-term jumpers first."""
    site = db.session.get(JumperSite, site_id)
    if not site:
        return jsonify({'error': 'Site not found'}), 404

    # Cancel pending reminders for active short-term jumpers at this site
    for jumper in site.jumpers:
        if jumper.removed_at is None and not jumper.is_long_term:
            _cancel_jumper_reminder_safe(jumper.id)

    db.session.delete(site)
    db.session.commit()
    return jsonify({'deleted': True})


# ═══════════════════════════════════════════════════════════════════
# Jumper Endpoints
# ═══════════════════════════════════════════════════════════════════

@jumpers_bp.route('/sites/<int:site_id>/jumpers', methods=['GET'])
def list_jumpers(site_id):
    """List jumpers for a site.

    Query params:
        status: 'active' (default), 'removed', or 'all'
        cpu_id: Filter by CPU
        tag_id: Filter by tag
    """
    site = db.session.get(JumperSite, site_id)
    if not site:
        return jsonify({'error': 'Site not found'}), 404

    status = request.args.get('status', 'active')
    cpu_id = request.args.get('cpu_id', type=int)
    tag_id = request.args.get('tag_id', type=int)

    query = Jumper.query.filter_by(site_id=site_id)

    # Filter by active/removed status
    if status == 'active':
        query = query.filter(Jumper.removed_at.is_(None))
    elif status == 'removed':
        query = query.filter(Jumper.removed_at.isnot(None))
    # 'all' = no filter

    if cpu_id is not None:
        query = query.filter_by(cpu_id=cpu_id)
    if tag_id is not None:
        query = query.filter_by(tag_id=tag_id)

    jumpers = query.order_by(Jumper.installed_at.desc()).all()
    return jsonify([j.to_dict() for j in jumpers])


@jumpers_bp.route('/sites/<int:site_id>/jumpers', methods=['POST'])
def create_jumper(site_id):
    """Create a new jumper at a site.

    Required: cpu_name, location, reason
    Optional: description, permit_number, moc_number, tag_name,
              is_long_term, installed_at
    """
    site = db.session.get(JumperSite, site_id)
    if not site:
        return jsonify({'error': 'Site not found'}), 404

    data = request.get_json() or {}

    # Validate required fields
    if not data.get('cpu_name', '').strip():
        return jsonify({'error': 'cpu_name is required'}), 400
    if not data.get('location', '').strip():
        return jsonify({'error': 'location is required'}), 400
    if not data.get('reason', '').strip():
        return jsonify({'error': 'reason is required'}), 400

    # Get or create CPU and tag
    cpu = _get_or_create_cpu(site_id, data['cpu_name'])
    tag = _get_or_create_tag(site_id, data.get('tag_name'))

    # Parse optional installed_at (defaults to now via model default)
    installed_at = _parse_installed_at(data)
    is_long_term = bool(data.get('is_long_term', False))

    jumper = Jumper(
        site_id=site_id,
        cpu_id=cpu.id if cpu else None,
        tag_id=tag.id if tag else None,
        location=data['location'].strip(),
        reason=data['reason'].strip(),
        description=data.get('description'),
        permit_number=data.get('permit_number'),
        moc_number=data.get('moc_number'),
        is_long_term=is_long_term,
    )
    if installed_at:
        jumper.installed_at = installed_at

    db.session.add(jumper)
    db.session.commit()

    # Schedule 8-hour reminder for short-term jumpers
    if not is_long_term:
        fire_at = jumper.installed_at + timedelta(hours=REMINDER_HOURS)
        _schedule_jumper_reminder_safe(jumper.id, fire_at)

    return jsonify(jumper.to_dict()), 201


@jumpers_bp.route('/<int:jumper_id>', methods=['GET'])
def get_jumper(jumper_id):
    """Get a single jumper by ID."""
    jumper = db.session.get(Jumper, jumper_id)
    if not jumper:
        return jsonify({'error': 'Jumper not found'}), 404
    return jsonify(jumper.to_dict())


@jumpers_bp.route('/<int:jumper_id>', methods=['PUT'])
def update_jumper(jumper_id):
    """Update a jumper. Handles cpu_name and tag_name (get-or-create).

    If is_long_term is toggled:
      - short -> long: cancels pending reminder
      - long -> short: schedules reminder (if active and not already notified)
    """
    jumper = db.session.get(Jumper, jumper_id)
    if not jumper:
        return jsonify({'error': 'Jumper not found'}), 404

    data = request.get_json() or {}

    # Handle cpu_name (get-or-create)
    if 'cpu_name' in data:
        cpu = _get_or_create_cpu(jumper.site_id, data['cpu_name'])
        jumper.cpu_id = cpu.id if cpu else None

    # Handle tag_name (get-or-create)
    if 'tag_name' in data:
        tag = _get_or_create_tag(jumper.site_id, data['tag_name'])
        jumper.tag_id = tag.id if tag else None

    # Simple field updates
    if 'location' in data:
        jumper.location = data['location']
    if 'reason' in data:
        jumper.reason = data['reason']
    if 'description' in data:
        jumper.description = data['description']
    if 'permit_number' in data:
        jumper.permit_number = data['permit_number']
    if 'moc_number' in data:
        jumper.moc_number = data['moc_number']

    # Handle installed_at update
    installed_at = _parse_installed_at(data)
    if installed_at:
        jumper.installed_at = installed_at

    # Handle is_long_term toggle with reminder scheduling
    if 'is_long_term' in data:
        was_long_term = jumper.is_long_term
        now_long_term = bool(data['is_long_term'])
        jumper.is_long_term = now_long_term

        if was_long_term and not now_long_term:
            # Long -> short: schedule reminder if still active and not already notified
            if jumper.removed_at is None and jumper.notified_at is None:
                fire_at = jumper.installed_at + timedelta(hours=REMINDER_HOURS)
                _schedule_jumper_reminder_safe(jumper.id, fire_at)
        elif not was_long_term and now_long_term:
            # Short -> long: cancel any pending reminder
            _cancel_jumper_reminder_safe(jumper.id)

    db.session.commit()
    return jsonify(jumper.to_dict())


@jumpers_bp.route('/<int:jumper_id>/remove', methods=['PUT'])
def remove_jumper(jumper_id):
    """Soft-remove a jumper (set removed_at timestamp).

    Optional body: { "removal_note": "..." }
    Returns 400 if already removed.
    """
    jumper = db.session.get(Jumper, jumper_id)
    if not jumper:
        return jsonify({'error': 'Jumper not found'}), 404

    if jumper.removed_at is not None:
        return jsonify({'error': 'Jumper is already removed'}), 400

    data = request.get_json(silent=True) or {}

    jumper.removed_at = datetime.now(timezone.utc)
    jumper.removal_note = data.get('removal_note')

    # Cancel any pending reminder
    _cancel_jumper_reminder_safe(jumper.id)

    db.session.commit()
    return jsonify(jumper.to_dict())


@jumpers_bp.route('/<int:jumper_id>', methods=['DELETE'])
def delete_jumper(jumper_id):
    """Hard-delete a jumper. Cancels any pending reminder first."""
    jumper = db.session.get(Jumper, jumper_id)
    if not jumper:
        return jsonify({'error': 'Jumper not found'}), 404

    _cancel_jumper_reminder_safe(jumper.id)

    db.session.delete(jumper)
    db.session.commit()
    return jsonify({'deleted': True})


# ═══════════════════════════════════════════════════════════════════
# Stats Endpoint
# ═══════════════════════════════════════════════════════════════════

@jumpers_bp.route('/stats', methods=['GET'])
def get_stats():
    """Aggregate jumper statistics across all sites.

    Returns:
        total_active: Count of all active jumpers
        most_recent: Full dict of the newest active jumper (or None)
        oldest_active: Full dict of the oldest active jumper with age_hours (or None)
        overdue_count: Short-term active jumpers installed >8 hours ago
        sites_by_active_count: List of {id, name, active_count} sorted desc
    """
    now = datetime.now(timezone.utc)

    # All active jumpers (removed_at IS NULL)
    active_jumpers = Jumper.query.filter(
        Jumper.removed_at.is_(None)
    ).all()

    total_active = len(active_jumpers)

    # Most recent active jumper (newest installed_at)
    most_recent = None
    if active_jumpers:
        newest = max(active_jumpers, key=lambda j: j.installed_at)
        most_recent = newest.to_dict()

    # Oldest active jumper (earliest installed_at) with age_hours
    oldest_active = None
    if active_jumpers:
        oldest = min(active_jumpers, key=lambda j: j.installed_at)
        age_seconds = (now - oldest.installed_at).total_seconds()
        oldest_dict = oldest.to_dict()
        oldest_dict['age_hours'] = round(age_seconds / 3600, 1)
        oldest_active = oldest_dict

    # Overdue count: short-term active jumpers installed more than 8 hours ago
    cutoff = now - timedelta(hours=REMINDER_HOURS)
    overdue_count = sum(
        1 for j in active_jumpers
        if not j.is_long_term and j.installed_at < cutoff
    )

    # Sites by active count (only sites with active jumpers)
    site_counts = {}
    for j in active_jumpers:
        if j.site_id not in site_counts:
            site_counts[j.site_id] = {
                'id': j.site_id,
                'name': j.site.name if j.site else 'Unknown',
                'active_count': 0,
            }
        site_counts[j.site_id]['active_count'] += 1

    sites_by_active_count = sorted(
        site_counts.values(),
        key=lambda s: s['active_count'],
        reverse=True,
    )

    return jsonify({
        'total_active': total_active,
        'most_recent': most_recent,
        'oldest_active': oldest_active,
        'overdue_count': overdue_count,
        'sites_by_active_count': sites_by_active_count,
    })
