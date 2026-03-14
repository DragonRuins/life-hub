# Jumpers/Bypasses Module — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a PLC jumper/bypass tracking module with per-site management, progressive CPU/tag registration, 8-hour push notification reminders, and native Apple app views (Mac, iPad, iPhone).

**Architecture:** Flask backend with 4 SQLAlchemy models (sites, CPUs, tags, jumpers), REST API at `/api/jumpers/`, APScheduler one-shot jobs for 8hr reminders (same pattern as launch reminders), SwiftUI views with `@Observable` ViewModel consuming the API via the existing `APIClient` actor.

**Tech Stack:** Python/Flask/SQLAlchemy/PostgreSQL (backend), Swift 6/SwiftUI/iOS 26+ (Apple app), APScheduler (notifications)

---

### Task 1: Backend — Database Models

**Files:**
- Create: `backend/app/models/jumper.py`
- Modify: `backend/app/models/__init__.py`

**Step 1: Create the jumper models file**

Create `backend/app/models/jumper.py` with four model classes:

```python
"""
Jumper/Bypass Module - Database Models

Defines four tables:
  - jumper_sites: Customer facilities where you do PLC work
  - jumper_cpus: Progressively registered PLC processors per site
  - jumper_tags: Progressively registered job tags per site
  - jumpers: The actual bypass records with install/remove tracking
"""
from datetime import datetime, timezone
from app import db


class JumperSite(db.Model):
    """A customer facility where PLC work is performed."""
    __tablename__ = 'jumper_sites'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    address = db.Column(db.String(500))
    contact_name = db.Column(db.String(200))
    contact_phone = db.Column(db.String(50))
    contact_email = db.Column(db.String(200))
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    cpus = db.relationship('JumperCPU', backref='site', cascade='all, delete-orphan')
    tags = db.relationship('JumperTag', backref='site', cascade='all, delete-orphan')
    jumpers = db.relationship('Jumper', backref='site', cascade='all, delete-orphan')

    def to_dict(self, include_counts=False):
        """Convert to dictionary for JSON responses."""
        d = {
            'id': self.id,
            'name': self.name,
            'address': self.address,
            'contact_name': self.contact_name,
            'contact_phone': self.contact_phone,
            'contact_email': self.contact_email,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_counts:
            d['active_jumper_count'] = sum(1 for j in self.jumpers if j.removed_at is None)
        return d

    def to_detail_dict(self):
        """Full detail including CPUs, tags, and jumpers."""
        d = self.to_dict(include_counts=True)
        d['cpus'] = [c.to_dict() for c in self.cpus]
        d['tags'] = [t.to_dict() for t in self.tags]
        return d


class JumperCPU(db.Model):
    """A PLC processor at a site, progressively registered on first use."""
    __tablename__ = 'jumper_cpus'

    id = db.Column(db.Integer, primary_key=True)
    site_id = db.Column(
        db.Integer,
        db.ForeignKey('jumper_sites.id', ondelete='CASCADE'),
        nullable=False
    )
    name = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.UniqueConstraint('site_id', 'name', name='uq_jumper_cpu_site_name'),
    )

    jumpers = db.relationship('Jumper', backref='cpu')

    def to_dict(self):
        return {
            'id': self.id,
            'site_id': self.site_id,
            'name': self.name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class JumperTag(db.Model):
    """A job tag at a site, progressively registered on first use."""
    __tablename__ = 'jumper_tags'

    id = db.Column(db.Integer, primary_key=True)
    site_id = db.Column(
        db.Integer,
        db.ForeignKey('jumper_sites.id', ondelete='CASCADE'),
        nullable=False
    )
    name = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.UniqueConstraint('site_id', 'name', name='uq_jumper_tag_site_name'),
    )

    jumpers = db.relationship('Jumper', backref='tag')

    def to_dict(self):
        return {
            'id': self.id,
            'site_id': self.site_id,
            'name': self.name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Jumper(db.Model):
    """A PLC logic jumper/bypass record."""
    __tablename__ = 'jumpers'

    id = db.Column(db.Integer, primary_key=True)
    site_id = db.Column(
        db.Integer,
        db.ForeignKey('jumper_sites.id', ondelete='CASCADE'),
        nullable=False
    )
    cpu_id = db.Column(
        db.Integer,
        db.ForeignKey('jumper_cpus.id', ondelete='SET NULL')
    )
    tag_id = db.Column(
        db.Integer,
        db.ForeignKey('jumper_tags.id', ondelete='SET NULL'),
        nullable=True
    )
    location = db.Column(db.String(500), nullable=False)
    reason = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text)
    permit_number = db.Column(db.String(100))
    moc_number = db.Column(db.String(100))
    is_long_term = db.Column(db.Boolean, nullable=False, default=False)
    installed_at = db.Column(db.DateTime, nullable=False,
                             default=lambda: datetime.now(timezone.utc))
    removed_at = db.Column(db.DateTime)
    removal_note = db.Column(db.Text)
    notified_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        db.Index('ix_jumpers_site_id', 'site_id'),
        db.Index('ix_jumpers_removed_at', 'removed_at'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'site_id': self.site_id,
            'cpu_id': self.cpu_id,
            'cpu_name': self.cpu.name if self.cpu else None,
            'tag_id': self.tag_id,
            'tag_name': self.tag.name if self.tag else None,
            'site_name': self.site.name if self.site else None,
            'location': self.location,
            'reason': self.reason,
            'description': self.description,
            'permit_number': self.permit_number,
            'moc_number': self.moc_number,
            'is_long_term': self.is_long_term,
            'installed_at': self.installed_at.isoformat() if self.installed_at else None,
            'removed_at': self.removed_at.isoformat() if self.removed_at else None,
            'removal_note': self.removal_note,
            'notified_at': self.notified_at.isoformat() if self.notified_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
```

**Step 2: Register models in `__init__.py`**

Add to `backend/app/models/__init__.py`:

```python
from .jumper import JumperSite, JumperCPU, JumperTag, Jumper
```

**Step 3: Register in app factory**

Add to `backend/app/__init__.py`:

In the imports section (around line 114, the `from app.models import ...` line), add `jumper` to the import list.

**Step 4: Commit**

```bash
git add backend/app/models/jumper.py backend/app/models/__init__.py backend/app/__init__.py
git commit -m "feat(jumpers): add database models for sites, CPUs, tags, and jumpers"
```

---

### Task 2: Backend — API Routes

**Files:**
- Create: `backend/app/routes/jumpers.py`
- Modify: `backend/app/__init__.py` (register blueprint)

**Step 1: Create the routes file**

Create `backend/app/routes/jumpers.py` with all endpoints:

```python
"""
Jumpers Module - API Routes

PLC logic jumper/bypass tracking with per-site management,
progressive CPU/tag registration, and 8-hour reminder notifications.

Endpoints:
  Sites:
    GET    /api/jumpers/sites              -> List all sites with active counts
    POST   /api/jumpers/sites              -> Create a site
    GET    /api/jumpers/sites/<id>         -> Site detail with CPUs, tags
    PUT    /api/jumpers/sites/<id>         -> Update a site
    DELETE /api/jumpers/sites/<id>         -> Delete site (cascades)

  Jumpers:
    GET    /api/jumpers/sites/<sid>/jumpers -> List jumpers for site (filterable)
    POST   /api/jumpers/sites/<sid>/jumpers -> Create jumper (auto-creates CPU/tag)
    GET    /api/jumpers/jumpers/<id>       -> Get single jumper
    PUT    /api/jumpers/jumpers/<id>       -> Update jumper
    PUT    /api/jumpers/jumpers/<id>/remove -> Mark as removed
    DELETE /api/jumpers/jumpers/<id>       -> Hard delete

  Stats:
    GET    /api/jumpers/stats              -> Dashboard statistics
"""
from datetime import datetime, timedelta, timezone

from flask import Blueprint, request, jsonify
from sqlalchemy import func

from app import db
from app.models.jumper import JumperSite, JumperCPU, JumperTag, Jumper

jumpers_bp = Blueprint('jumpers', __name__)


# ── Helper: get-or-create CPU/Tag ─────────────────────────────────

def _get_or_create_cpu(site_id, cpu_name):
    """Find existing CPU by name for this site, or create it."""
    cpu_name = cpu_name.strip()
    cpu = JumperCPU.query.filter_by(site_id=site_id, name=cpu_name).first()
    if not cpu:
        cpu = JumperCPU(site_id=site_id, name=cpu_name)
        db.session.add(cpu)
        db.session.flush()  # Get the ID before we use it
    return cpu


def _get_or_create_tag(site_id, tag_name):
    """Find existing tag by name for this site, or create it."""
    tag_name = tag_name.strip()
    tag = JumperTag.query.filter_by(site_id=site_id, name=tag_name).first()
    if not tag:
        tag = JumperTag(site_id=site_id, name=tag_name)
        db.session.add(tag)
        db.session.flush()
    return tag


# ── Sites ─────────────────────────────────────────────────────────

@jumpers_bp.route('/sites', methods=['GET'])
def list_sites():
    """List all sites with active jumper counts."""
    sites = JumperSite.query.order_by(JumperSite.name).all()
    return jsonify([s.to_dict(include_counts=True) for s in sites])


@jumpers_bp.route('/sites', methods=['POST'])
def create_site():
    """Create a new site."""
    data = request.get_json()
    if not data or not data.get('name', '').strip():
        return jsonify({'error': 'Name is required'}), 400

    site = JumperSite(
        name=data['name'].strip(),
        address=data.get('address', '').strip() or None,
        contact_name=data.get('contact_name', '').strip() or None,
        contact_phone=data.get('contact_phone', '').strip() or None,
        contact_email=data.get('contact_email', '').strip() or None,
        notes=data.get('notes', '').strip() or None,
    )
    db.session.add(site)
    db.session.commit()
    return jsonify(site.to_dict(include_counts=True)), 201


@jumpers_bp.route('/sites/<int:site_id>', methods=['GET'])
def get_site(site_id):
    """Get site detail including CPUs, tags, and active jumper count."""
    site = db.session.get(JumperSite, site_id)
    if not site:
        return jsonify({'error': 'Site not found'}), 404
    return jsonify(site.to_detail_dict())


@jumpers_bp.route('/sites/<int:site_id>', methods=['PUT'])
def update_site(site_id):
    """Update a site."""
    site = db.session.get(JumperSite, site_id)
    if not site:
        return jsonify({'error': 'Site not found'}), 404

    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    if 'name' in data:
        name = data['name'].strip()
        if not name:
            return jsonify({'error': 'Name cannot be empty'}), 400
        site.name = name
    if 'address' in data:
        site.address = data['address'].strip() or None
    if 'contact_name' in data:
        site.contact_name = data['contact_name'].strip() or None
    if 'contact_phone' in data:
        site.contact_phone = data['contact_phone'].strip() or None
    if 'contact_email' in data:
        site.contact_email = data['contact_email'].strip() or None
    if 'notes' in data:
        site.notes = data['notes'].strip() or None

    db.session.commit()
    return jsonify(site.to_dict(include_counts=True))


@jumpers_bp.route('/sites/<int:site_id>', methods=['DELETE'])
def delete_site(site_id):
    """Delete a site and all its jumpers, CPUs, tags (cascade)."""
    site = db.session.get(JumperSite, site_id)
    if not site:
        return jsonify({'error': 'Site not found'}), 404

    # Cancel any pending reminders for this site's jumpers
    for jumper in site.jumpers:
        if jumper.removed_at is None and not jumper.is_long_term:
            _cancel_jumper_reminder_safe(jumper.id)

    db.session.delete(site)
    db.session.commit()
    return jsonify({'message': 'Site deleted'})


# ── Jumpers ───────────────────────────────────────────────────────

@jumpers_bp.route('/sites/<int:site_id>/jumpers', methods=['GET'])
def list_jumpers(site_id):
    """List jumpers for a site with optional filters."""
    site = db.session.get(JumperSite, site_id)
    if not site:
        return jsonify({'error': 'Site not found'}), 404

    query = Jumper.query.filter_by(site_id=site_id)

    # Filter by status: 'active' (default), 'removed', 'all'
    status = request.args.get('status', 'active')
    if status == 'active':
        query = query.filter(Jumper.removed_at.is_(None))
    elif status == 'removed':
        query = query.filter(Jumper.removed_at.isnot(None))
    # 'all' = no filter

    # Filter by CPU
    cpu_id = request.args.get('cpu_id', type=int)
    if cpu_id:
        query = query.filter_by(cpu_id=cpu_id)

    # Filter by tag
    tag_id = request.args.get('tag_id', type=int)
    if tag_id:
        query = query.filter_by(tag_id=tag_id)

    jumpers = query.order_by(Jumper.installed_at.desc()).all()
    return jsonify([j.to_dict() for j in jumpers])


@jumpers_bp.route('/sites/<int:site_id>/jumpers', methods=['POST'])
def create_jumper(site_id):
    """Create a jumper. Auto-creates CPU and tag if new names are provided."""
    site = db.session.get(JumperSite, site_id)
    if not site:
        return jsonify({'error': 'Site not found'}), 404

    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    # Validate required fields
    cpu_name = (data.get('cpu_name') or '').strip()
    location = (data.get('location') or '').strip()
    reason = (data.get('reason') or '').strip()

    if not cpu_name:
        return jsonify({'error': 'CPU name is required'}), 400
    if not location:
        return jsonify({'error': 'Location is required'}), 400
    if not reason:
        return jsonify({'error': 'Reason is required'}), 400

    # Get or create CPU
    cpu = _get_or_create_cpu(site_id, cpu_name)

    # Get or create tag (optional)
    tag = None
    tag_name = (data.get('tag_name') or '').strip()
    if tag_name:
        tag = _get_or_create_tag(site_id, tag_name)

    # Parse installed_at or default to now
    installed_at = datetime.now(timezone.utc)
    if data.get('installed_at'):
        try:
            raw = data['installed_at'].replace('Z', '+00:00')
            installed_at = datetime.fromisoformat(raw)
        except (ValueError, AttributeError):
            pass

    is_long_term = bool(data.get('is_long_term', False))

    jumper = Jumper(
        site_id=site_id,
        cpu_id=cpu.id,
        tag_id=tag.id if tag else None,
        location=location,
        reason=reason,
        description=(data.get('description') or '').strip() or None,
        permit_number=(data.get('permit_number') or '').strip() or None,
        moc_number=(data.get('moc_number') or '').strip() or None,
        is_long_term=is_long_term,
        installed_at=installed_at,
    )
    db.session.add(jumper)
    db.session.commit()

    # Schedule 8-hour reminder for short-term jumpers
    if not is_long_term:
        fire_at = installed_at + timedelta(hours=8)
        _schedule_jumper_reminder_safe(jumper.id, fire_at)

    return jsonify(jumper.to_dict()), 201


@jumpers_bp.route('/jumpers/<int:jumper_id>', methods=['GET'])
def get_jumper(jumper_id):
    """Get a single jumper."""
    jumper = db.session.get(Jumper, jumper_id)
    if not jumper:
        return jsonify({'error': 'Jumper not found'}), 404
    return jsonify(jumper.to_dict())


@jumpers_bp.route('/jumpers/<int:jumper_id>', methods=['PUT'])
def update_jumper(jumper_id):
    """Update a jumper. Handles short/long-term toggle for notification scheduling."""
    jumper = db.session.get(Jumper, jumper_id)
    if not jumper:
        return jsonify({'error': 'Jumper not found'}), 404

    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    was_long_term = jumper.is_long_term

    # Update CPU if name changed
    if 'cpu_name' in data:
        cpu_name = data['cpu_name'].strip()
        if cpu_name:
            cpu = _get_or_create_cpu(jumper.site_id, cpu_name)
            jumper.cpu_id = cpu.id

    # Update tag if name changed
    if 'tag_name' in data:
        tag_name = data['tag_name'].strip()
        if tag_name:
            tag = _get_or_create_tag(jumper.site_id, tag_name)
            jumper.tag_id = tag.id
        else:
            jumper.tag_id = None

    if 'location' in data:
        jumper.location = data['location'].strip()
    if 'reason' in data:
        jumper.reason = data['reason'].strip()
    if 'description' in data:
        jumper.description = data['description'].strip() or None
    if 'permit_number' in data:
        jumper.permit_number = data['permit_number'].strip() or None
    if 'moc_number' in data:
        jumper.moc_number = data['moc_number'].strip() or None
    if 'is_long_term' in data:
        jumper.is_long_term = bool(data['is_long_term'])
    if 'installed_at' in data and data['installed_at']:
        try:
            raw = data['installed_at'].replace('Z', '+00:00')
            jumper.installed_at = datetime.fromisoformat(raw)
        except (ValueError, AttributeError):
            pass

    db.session.commit()

    # Handle notification scheduling changes
    if jumper.removed_at is None:
        if not was_long_term and jumper.is_long_term:
            # Toggled to long-term: cancel reminder
            _cancel_jumper_reminder_safe(jumper.id)
        elif was_long_term and not jumper.is_long_term and not jumper.notified_at:
            # Toggled back to short-term: schedule reminder
            fire_at = jumper.installed_at + timedelta(hours=8)
            _schedule_jumper_reminder_safe(jumper.id, fire_at)

    return jsonify(jumper.to_dict())


@jumpers_bp.route('/jumpers/<int:jumper_id>/remove', methods=['PUT'])
def remove_jumper(jumper_id):
    """Mark a jumper as removed (soft delete)."""
    jumper = db.session.get(Jumper, jumper_id)
    if not jumper:
        return jsonify({'error': 'Jumper not found'}), 404

    if jumper.removed_at:
        return jsonify({'error': 'Jumper already removed'}), 400

    data = request.get_json() or {}
    jumper.removed_at = datetime.now(timezone.utc)
    jumper.removal_note = (data.get('removal_note') or '').strip() or None
    db.session.commit()

    # Cancel pending reminder
    _cancel_jumper_reminder_safe(jumper.id)

    return jsonify(jumper.to_dict())


@jumpers_bp.route('/jumpers/<int:jumper_id>', methods=['DELETE'])
def delete_jumper(jumper_id):
    """Hard delete a jumper (for mistakes)."""
    jumper = db.session.get(Jumper, jumper_id)
    if not jumper:
        return jsonify({'error': 'Jumper not found'}), 404

    # Cancel pending reminder
    _cancel_jumper_reminder_safe(jumper.id)

    db.session.delete(jumper)
    db.session.commit()
    return jsonify({'message': 'Jumper deleted'})


# ── Stats ─────────────────────────────────────────────────────────

@jumpers_bp.route('/stats', methods=['GET'])
def get_stats():
    """Dashboard statistics for the jumpers module."""
    now = datetime.now(timezone.utc)
    eight_hours_ago = now - timedelta(hours=8)

    # All active jumpers
    active_jumpers = Jumper.query.filter(Jumper.removed_at.is_(None)).all()
    total_active = len(active_jumpers)

    # Most recent jumper
    most_recent = None
    if active_jumpers:
        newest = max(active_jumpers, key=lambda j: j.installed_at)
        most_recent = newest.to_dict()

    # Oldest active jumper
    oldest = None
    if active_jumpers:
        oldest_j = min(active_jumpers, key=lambda j: j.installed_at)
        oldest = oldest_j.to_dict()
        oldest['age_hours'] = (now - oldest_j.installed_at).total_seconds() / 3600

    # Overdue count: short-term jumpers older than 8 hours
    overdue_count = sum(
        1 for j in active_jumpers
        if not j.is_long_term and j.installed_at < eight_hours_ago
    )

    # Sites ranked by active jumper count
    sites = JumperSite.query.all()
    site_rankings = []
    for site in sites:
        count = sum(1 for j in site.jumpers if j.removed_at is None)
        if count > 0:
            site_rankings.append({
                'id': site.id,
                'name': site.name,
                'active_count': count,
            })
    site_rankings.sort(key=lambda s: s['active_count'], reverse=True)

    return jsonify({
        'total_active': total_active,
        'most_recent': most_recent,
        'oldest_active': oldest,
        'overdue_count': overdue_count,
        'sites_by_active_count': site_rankings,
    })


# ── Notification Helpers ──────────────────────────────────────────

def _schedule_jumper_reminder_safe(jumper_id, fire_at):
    """Schedule an 8-hour reminder. Safe to call if scheduler is unavailable."""
    try:
        from app.services.scheduler import schedule_jumper_reminder
        schedule_jumper_reminder(jumper_id, fire_at)
    except Exception:
        pass


def _cancel_jumper_reminder_safe(jumper_id):
    """Cancel a pending reminder. Safe to call if scheduler is unavailable."""
    try:
        from app.services.scheduler import cancel_jumper_reminder
        cancel_jumper_reminder(jumper_id)
    except Exception:
        pass
```

**Step 2: Register the blueprint in app factory**

In `backend/app/__init__.py`, add after the GPS blueprint registration (around line 104):

```python
from app.routes.jumpers import jumpers_bp
app.register_blueprint(jumpers_bp, url_prefix='/api/jumpers')
```

**Step 3: Commit**

```bash
git add backend/app/routes/jumpers.py backend/app/__init__.py
git commit -m "feat(jumpers): add REST API routes for sites, jumpers, and stats"
```

---

### Task 3: Backend — Scheduler Integration (8hr Reminders)

**Files:**
- Modify: `backend/app/services/scheduler.py`

**Step 1: Add jumper reminder functions**

Add the following to `backend/app/services/scheduler.py`, after the existing launch reminder section (around line 848):

```python
# ═══════════════════════════════════════════════════════════════════════════
# Jumper 8-Hour Reminder Jobs
# ═══════════════════════════════════════════════════════════════════════════

def schedule_jumper_reminder(jumper_id, fire_at):
    """
    Schedule a one-shot APScheduler job to remind about an active jumper
    after 8 hours.

    Args:
        jumper_id: Jumper.id to look up at fire time
        fire_at: datetime (UTC) when the notification should fire
    """
    global scheduler
    if not scheduler:
        logger.warning("Scheduler not initialized, cannot schedule jumper reminder")
        return

    job_id = f"jumper_reminder_{jumper_id}"

    scheduler.add_job(
        _fire_jumper_reminder,
        trigger='date',
        id=job_id,
        run_date=fire_at,
        args=[jumper_id],
        replace_existing=True,
    )
    logger.info(f"Scheduled jumper reminder job '{job_id}' for {fire_at.isoformat()}")


def cancel_jumper_reminder(jumper_id):
    """
    Cancel a scheduled jumper reminder. Safe to call if the job already fired
    or doesn't exist.
    """
    global scheduler
    if not scheduler:
        return

    job_id = f"jumper_reminder_{jumper_id}"
    try:
        scheduler.remove_job(job_id)
        logger.info(f"Cancelled jumper reminder job '{job_id}'")
    except Exception:
        pass


def _fire_jumper_reminder(jumper_id):
    """
    Called by APScheduler at installed_at + 8 hours.
    Checks if the jumper is still active and short-term, then sends push.
    """
    global _app
    if not _app:
        return

    with _app.app_context():
        from app import db
        from app.models.jumper import Jumper

        try:
            jumper = db.session.get(Jumper, jumper_id)
            if not jumper:
                logger.warning(f"Jumper {jumper_id} not found at reminder time")
                return

            # Only fire if still active and short-term
            if jumper.removed_at is not None:
                logger.debug(f"Jumper {jumper_id} already removed, skipping reminder")
                return
            if jumper.is_long_term:
                logger.debug(f"Jumper {jumper_id} is long-term, skipping reminder")
                return

            # Build notification content
            site_name = jumper.site.name if jumper.site else 'Unknown Site'
            cpu_name = jumper.cpu.name if jumper.cpu else 'Unknown CPU'
            title = "Jumper Still Active"
            body = (
                f"Jumper at {site_name} / {cpu_name} — {jumper.location} "
                f"has been in place for 8 hours. Reason: {jumper.reason}"
            )

            # Send push notification
            schedule_delayed_push(
                title, body, 'high',
                thread_id='jumpers',
                category='JUMPER_REMINDER',
                deep_link='datacore://jumpers',
                interruption_level='time-sensitive',
            )

            # Mark as notified
            jumper.notified_at = datetime.now(timezone.utc)
            db.session.commit()
            logger.info(f"Fired jumper reminder: {site_name} / {cpu_name} — {jumper.location}")

        except Exception as e:
            logger.error(f"Failed to fire jumper reminder {jumper_id}: {e}")
            try:
                db.session.rollback()
            except Exception:
                pass


def _reconcile_jumper_reminders():
    """
    Startup reconciliation: check for active short-term jumpers that are
    overdue (>8hrs, notified_at IS NULL) and fire missed notifications.
    Also reschedule reminders for jumpers that haven't hit 8hrs yet.
    """
    global scheduler
    if not scheduler:
        return

    from app import db
    from app.models.jumper import Jumper

    try:
        # Find all active short-term jumpers that haven't been notified
        pending = Jumper.query.filter(
            Jumper.removed_at.is_(None),
            Jumper.is_long_term == False,  # noqa: E712
            Jumper.notified_at.is_(None),
        ).all()

        if not pending:
            return

        now = datetime.now(timezone.utc)
        rescheduled = 0
        fired_late = 0

        for jumper in pending:
            fire_at = jumper.installed_at + timedelta(hours=8)
            job_id = f"jumper_reminder_{jumper.id}"

            # Check if APScheduler job still exists
            existing_job = None
            try:
                existing_job = scheduler.get_job(job_id)
            except Exception:
                pass

            if existing_job:
                continue  # Job is still scheduled, nothing to do

            if fire_at > now:
                # Not yet due — reschedule
                schedule_jumper_reminder(jumper.id, fire_at)
                rescheduled += 1
            elif (now - fire_at).total_seconds() <= 3600:
                # Due within last hour — fire now
                _fire_jumper_reminder(jumper.id)
                fired_late += 1
            else:
                # More than 1 hour overdue — still fire it (jumpers are important)
                _fire_jumper_reminder(jumper.id)
                fired_late += 1

        logger.info(
            f"Jumper reminder reconciliation: {rescheduled} rescheduled, "
            f"{fired_late} fired late"
        )

    except Exception as e:
        logger.error(f"Jumper reminder reconciliation failed: {e}")
```

**Step 2: Register reconciliation in init_scheduler**

In `init_scheduler()` (around line 73, after `_add_timecard_forgotten_timer_job()`), add:

```python
_reconcile_jumper_reminders()
```

**Step 3: Add the notification seed**

In `backend/app/__init__.py`, add a seed function and call it from `create_app()`:

```python
def _seed_jumper_notification_rules(db):
    """Seed default jumper notification rule on first startup."""
    from app.models.notification import NotificationRule

    rules = [
        {
            'name': 'Jumper 8-Hour Reminder',
            'event_name': 'jumper.reminder',
            'module': 'jumpers',
            'description': 'Reminder when a short-term jumper has been in place for 8+ hours',
            'title_template': 'Jumper Still Active',
            'body_template': 'Jumper at {{site_name}} / {{cpu_name}} — {{location}} has been in place for 8 hours.',
        },
    ]

    for rule_data in rules:
        existing = NotificationRule.query.filter_by(
            event_name=rule_data['event_name']
        ).first()
        if not existing:
            db.session.add(NotificationRule(
                name=rule_data['name'],
                description=rule_data['description'],
                module=rule_data['module'],
                rule_type='event',
                event_name=rule_data['event_name'],
                title_template=rule_data['title_template'],
                body_template=rule_data['body_template'],
                priority='high',
                is_enabled=True,  # Enabled by default — jumper reminders are critical
            ))
    db.session.commit()
```

Call it in `create_app()` alongside the other seed functions:

```python
try:
    _seed_jumper_notification_rules(db)
except Exception:
    pass
```

**Step 4: Commit**

```bash
git add backend/app/services/scheduler.py backend/app/__init__.py
git commit -m "feat(jumpers): add 8hr APScheduler reminders with startup reconciliation"
```

---

### Task 4: Apple App — Swift Models

**Files:**
- Create: `Datacore/Models/Jumper.swift`

**Step 1: Create Codable structs**

Create `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/Models/Jumper.swift`:

```swift
import Foundation

/// A customer facility where PLC work is performed.
/// Matches Flask JumperSite.to_dict() output.
struct JumperSite: Codable, Sendable, Identifiable {
    let id: Int
    let name: String
    let address: String?
    let contactName: String?
    let contactPhone: String?
    let contactEmail: String?
    let notes: String?
    let createdAt: String?
    let updatedAt: String?
    let activeJumperCount: Int?
    let cpus: [JumperCPU]?
    let tags: [JumperTag]?
}

/// A PLC processor at a site (progressively registered).
struct JumperCPU: Codable, Sendable, Identifiable {
    let id: Int
    let siteId: Int
    let name: String
    let createdAt: String?
}

/// A job tag at a site (progressively registered).
struct JumperTag: Codable, Sendable, Identifiable {
    let id: Int
    let siteId: Int
    let name: String
    let createdAt: String?
}

/// A PLC logic jumper/bypass record.
/// Matches Flask Jumper.to_dict() output.
struct Jumper: Codable, Sendable, Identifiable {
    let id: Int
    let siteId: Int
    let cpuId: Int?
    let cpuName: String?
    let tagId: Int?
    let tagName: String?
    let siteName: String?
    let location: String
    let reason: String
    let description: String?
    let permitNumber: String?
    let mocNumber: String?
    let isLongTerm: Bool
    let installedAt: String?
    let removedAt: String?
    let removalNote: String?
    let notifiedAt: String?
    let createdAt: String?
    let updatedAt: String?

    /// Whether this jumper is still active (not removed).
    var isActive: Bool { removedAt == nil }

    /// Parsed installation date.
    var installedDate: Date? {
        guard let installedAt else { return nil }
        return DateFormatting.parse(installedAt)
    }

    /// How long this jumper has been installed (human-readable).
    var ageDescription: String? {
        guard let date = installedDate else { return nil }
        let seconds = Date().timeIntervalSince(date)
        let hours = Int(seconds / 3600)
        if hours < 1 { return "< 1 hour" }
        if hours < 24 { return "\(hours)h" }
        let days = hours / 24
        return "\(days)d \(hours % 24)h"
    }
}

/// Dashboard statistics for the jumpers module.
struct JumperStats: Codable, Sendable {
    let totalActive: Int
    let mostRecent: Jumper?
    let oldestActive: OldestJumper?
    let overdueCount: Int
    let sitesByActiveCount: [SiteRanking]

    struct OldestJumper: Codable, Sendable {
        let id: Int
        let siteId: Int
        let siteName: String?
        let cpuName: String?
        let location: String
        let reason: String
        let installedAt: String?
        let ageHours: Double?
    }

    struct SiteRanking: Codable, Sendable, Identifiable {
        let id: Int
        let name: String
        let activeCount: Int
    }
}
```

**Step 2: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/Models/Jumper.swift
git commit -m "feat(jumpers): add Swift Codable models for sites, CPUs, tags, jumpers"
```

---

### Task 5: Apple App — Endpoint + ViewModel

**Files:**
- Modify: `Datacore/Network/Endpoint.swift`
- Create: `Datacore/ViewModels/JumpersViewModel.swift`
- Modify: `Datacore/Models/AppModule.swift`

**Step 1: Add endpoint cases**

Add to `Endpoint.swift` before the `var path` section, in a new MARK section:

```swift
// MARK: - Jumpers
case jumperSites                                    // GET  /api/jumpers/sites
case jumperSite(id: Int)                            // GET  /api/jumpers/sites/<id>
case createJumperSite                               // POST /api/jumpers/sites
case updateJumperSite(id: Int)                      // PUT  /api/jumpers/sites/<id>
case deleteJumperSite(id: Int)                      // DELETE /api/jumpers/sites/<id>
case jumpers(siteId: Int)                           // GET  /api/jumpers/sites/<sid>/jumpers
case createJumper(siteId: Int)                      // POST /api/jumpers/sites/<sid>/jumpers
case jumper(id: Int)                                // GET  /api/jumpers/jumpers/<id>
case updateJumper(id: Int)                          // PUT  /api/jumpers/jumpers/<id>
case removeJumper(id: Int)                          // PUT  /api/jumpers/jumpers/<id>/remove
case deleteJumper(id: Int)                          // DELETE /api/jumpers/jumpers/<id>
case jumperStats                                    // GET  /api/jumpers/stats
```

Add the path mappings in `var path`:

```swift
// Jumpers
case .jumperSites, .createJumperSite:                  return "/api/jumpers/sites"
case .jumperSite(let id),
     .updateJumperSite(let id),
     .deleteJumperSite(let id):                        return "/api/jumpers/sites/\(id)"
case .jumpers(let sid),
     .createJumper(let sid):                           return "/api/jumpers/sites/\(sid)/jumpers"
case .jumper(let id),
     .updateJumper(let id),
     .deleteJumper(let id):                            return "/api/jumpers/jumpers/\(id)"
case .removeJumper(let id):                            return "/api/jumpers/jumpers/\(id)/remove"
case .jumperStats:                                     return "/api/jumpers/stats"
```

**Step 2: Add the jumpers case to AppModule**

In `Datacore/Models/AppModule.swift`, add `case jumpers` to the enum and its title:

```swift
enum AppModule: String, Hashable, Codable {
    case dashboard, vehicles, notes, fuel, weather
    case projects, knowledge, infrastructure, astrometrics, trek
    case timecard, obd, debts, gpsTracking, jumpers, settings
    // ...
    case .jumpers: "Jumpers"
    // ...
}
```

**Step 3: Create the ViewModel**

Create `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/ViewModels/JumpersViewModel.swift`:

```swift
import Foundation

/// Manages jumper sites, jumper records, and module statistics.
@Observable
@MainActor
final class JumpersViewModel {
    // MARK: - State

    var stats: JumperStats?
    var sites: [JumperSite] = []
    var selectedSite: JumperSite?
    var jumpers: [Jumper] = []
    var isLoading = false
    var error: APIError?

    // MARK: - Stats

    func loadStats() async {
        do {
            stats = try await APIClient.shared.get(.jumperStats)
        } catch let apiError as APIError {
            self.error = apiError
        } catch {}
    }

    // MARK: - Sites

    func loadSites() async {
        isLoading = true
        defer { isLoading = false }
        do {
            sites = try await APIClient.shared.get(.jumperSites)
        } catch let apiError as APIError {
            self.error = apiError
        } catch {}
    }

    func loadSiteDetail(id: Int) async {
        do {
            selectedSite = try await APIClient.shared.get(.jumperSite(id: id))
        } catch let apiError as APIError {
            self.error = apiError
        } catch {}
    }

    struct SiteBody: Encodable, Sendable {
        let name: String
        let address: String?
        let contactName: String?
        let contactPhone: String?
        let contactEmail: String?
        let notes: String?
    }

    func createSite(_ body: SiteBody) async {
        do {
            let site: JumperSite = try await APIClient.shared.post(.createJumperSite, body: body)
            sites.append(site)
            sites.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        } catch let apiError as APIError {
            self.error = apiError
        } catch {}
    }

    func updateSite(id: Int, body: SiteBody) async {
        do {
            let updated: JumperSite = try await APIClient.shared.put(.updateJumperSite(id: id), body: body)
            if let idx = sites.firstIndex(where: { $0.id == id }) {
                sites[idx] = updated
            }
            if selectedSite?.id == id {
                await loadSiteDetail(id: id)
            }
        } catch let apiError as APIError {
            self.error = apiError
        } catch {}
    }

    func deleteSite(id: Int) async {
        do {
            try await APIClient.shared.delete(.deleteJumperSite(id: id))
            sites.removeAll { $0.id == id }
            if selectedSite?.id == id { selectedSite = nil }
        } catch let apiError as APIError {
            self.error = apiError
        } catch {}
    }

    // MARK: - Jumpers

    func loadJumpers(siteId: Int, status: String = "active") async {
        do {
            jumpers = try await APIClient.shared.get(
                .jumpers(siteId: siteId),
                queryItems: [.init(name: "status", value: status)]
            )
        } catch let apiError as APIError {
            self.error = apiError
        } catch {}
    }

    struct JumperBody: Encodable, Sendable {
        let cpuName: String
        let location: String
        let reason: String
        let description: String?
        let permitNumber: String?
        let mocNumber: String?
        let tagName: String?
        let isLongTerm: Bool
        let installedAt: String?
    }

    func createJumper(siteId: Int, body: JumperBody) async {
        do {
            let jumper: Jumper = try await APIClient.shared.post(.createJumper(siteId: siteId), body: body)
            jumpers.insert(jumper, at: 0)
            // Refresh site counts
            await loadSites()
        } catch let apiError as APIError {
            self.error = apiError
        } catch {}
    }

    func updateJumper(id: Int, body: JumperBody) async {
        do {
            let updated: Jumper = try await APIClient.shared.put(.updateJumper(id: id), body: body)
            if let idx = jumpers.firstIndex(where: { $0.id == id }) {
                jumpers[idx] = updated
            }
        } catch let apiError as APIError {
            self.error = apiError
        } catch {}
    }

    struct RemoveBody: Encodable, Sendable {
        let removalNote: String?
    }

    func removeJumper(id: Int, note: String? = nil) async {
        do {
            let updated: Jumper = try await APIClient.shared.put(
                .removeJumper(id: id),
                body: RemoveBody(removalNote: note)
            )
            if let idx = jumpers.firstIndex(where: { $0.id == id }) {
                jumpers[idx] = updated
            }
            await loadSites()
        } catch let apiError as APIError {
            self.error = apiError
        } catch {}
    }

    func deleteJumper(id: Int) async {
        do {
            try await APIClient.shared.delete(.deleteJumper(id: id))
            jumpers.removeAll { $0.id == id }
            await loadSites()
        } catch let apiError as APIError {
            self.error = apiError
        } catch {}
    }
}
```

**Step 4: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/Network/Endpoint.swift Datacore/ViewModels/JumpersViewModel.swift Datacore/Models/AppModule.swift
git commit -m "feat(jumpers): add Endpoint cases, AppModule, and JumpersViewModel"
```

---

### Task 6: Apple App — Navigation Wiring

**Files:**
- Modify: `Datacore/DatacoreApp.swift` (add environment VM)
- Modify: `Datacore/ContentView.swift` (add to selectedModuleView, iPhoneNavigation, ModuleLauncherSheet, Preview)
- Modify: `Datacore/Views/Shared/iPadSidebar.swift` (add jumpers row)
- Modify: `Datacore/Views/Shared/ModuleLauncherSheet.swift` (add jumpers card)
- Modify: `Datacore/MacApp/MacSidebar.swift` (add jumpers row)
- Modify: `Datacore/MacApp/MacModuleRouter.swift` (add jumpers case)
- Modify: `Datacore/MacApp/MacContentView.swift` (add Preview env if needed)

**Step 1: DatacoreApp.swift**

Add `@State private var jumpersVM = JumpersViewModel()` alongside other VMs (around line 69).

Add `.environment(jumpersVM)` to the ContentView modifier chain (around line 96).

**Step 2: ContentView.swift**

In `selectedModuleView` (both in MainTabView and ModuleLauncherTab), add:

```swift
case .jumpers:
    JumpersView()
```

In the Preview block, add `.environment(JumpersViewModel())`.

**Step 3: iPadSidebar.swift**

Add jumpers row in the "Productivity" section:

```swift
sidebarRow(.jumpers, icon: "bolt.horizontal.circle", label: "Jumpers")
```

Add badge logic in `badgeForModule`:

```swift
case .jumpers:
    // Badge will be added once JumpersViewModel has stats
    return nil
```

**Step 4: MacSidebar.swift**

Add jumpers row in the "Productivity" section:

```swift
sidebarRow(.jumpers, icon: "bolt.horizontal.circle", label: "Jumpers")
```

**Step 5: MacModuleRouter.swift**

Add:

```swift
case .jumpers:
    JumpersView()  // Shared view works on Mac (will add Mac-specific later if needed)
```

**Step 6: ModuleLauncherSheet.swift**

Add a jumpers card in the "Productivity" section:

```swift
moduleCard(.jumpers, icon: "bolt.horizontal.circle", tint: .purple)
    .staggerReveal(index: N, isVisible: cardsVisible)
```

(Adjust stagger indices accordingly)

**Step 7: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/DatacoreApp.swift Datacore/ContentView.swift \
        Datacore/Views/Shared/iPadSidebar.swift \
        Datacore/Views/Shared/ModuleLauncherSheet.swift \
        Datacore/MacApp/MacSidebar.swift \
        Datacore/MacApp/MacModuleRouter.swift
git commit -m "feat(jumpers): wire up navigation in all platforms (Mac, iPad, iPhone)"
```

---

### Task 7: Apple App — SwiftUI Views (Stats + Site List)

**Files:**
- Create: `Datacore/Views/Jumpers/JumpersView.swift`
- Create: `Datacore/Views/Jumpers/JumperSiteListView.swift`

**Step 1: Create the main JumpersView (stats dashboard + site list)**

Create `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/Views/Jumpers/JumpersView.swift`:

This is the module root. On iPhone, it's a single-column scroll with stats cards at top and site list below. On iPad/Mac, it uses a wider layout.

Key components:
- Stats section using `PremiumStatCard` and `CountingNumber` for total active, overdue, oldest age
- Site list section showing sites ranked by active count
- "Add Site" button in toolbar
- Pull-to-refresh
- `.staggerReveal()` on cards
- `.navigationBarTitleDisplayMode(sizeClass == .regular ? .inline : .large)`

**Step 2: Create JumperSiteListView**

Create `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/Views/Jumpers/JumperSiteListView.swift`:

Simple list of all sites with name, active count badge, and NavigationLink to site detail.

**Step 3: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/Views/Jumpers/
git commit -m "feat(jumpers): add stats dashboard and site list views"
```

---

### Task 8: Apple App — SwiftUI Views (Site Detail + Jumper List)

**Files:**
- Create: `Datacore/Views/Jumpers/JumperSiteDetailView.swift`
- Create: `Datacore/Views/Jumpers/JumperRowView.swift`

**Step 1: Create JumperSiteDetailView**

Shows:
- Site info header (name, address, contact, notes) with edit button
- Filter bar (active/removed/all, CPU picker, tag picker)
- Jumper list using JumperRowView
- "Add Jumper" button in toolbar
- iPad/Mac: side-by-side split for list + jumper detail

**Step 2: Create JumperRowView**

Each row shows:
- CPU name + location (primary text)
- Reason (secondary text)
- Permit #, MOC # if present
- Tag badge if present
- "Long-term" badge if applicable
- Installed time (relative, e.g., "2h ago" or "3d ago")
- Swipe actions: Remove, Edit, Delete

**Step 3: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/Views/Jumpers/
git commit -m "feat(jumpers): add site detail view with jumper list and row component"
```

---

### Task 9: Apple App — SwiftUI Views (Forms)

**Files:**
- Create: `Datacore/Views/Jumpers/JumperFormView.swift`
- Create: `Datacore/Views/Jumpers/JumperSiteFormView.swift`
- Create: `Datacore/Views/Jumpers/JumperRemoveSheet.swift`

**Step 1: Create JumperFormView**

Sheet for creating/editing a jumper:
- CPU field: `TextField` with suggestions dropdown (shows existing CPUs from the site, type new to create)
- Location: `TextField`
- Reason: `TextField`
- Description: `TextEditor` (multiline)
- Permit #: `TextField` (optional)
- MOC #: `TextField` (optional)
- Tag field: `TextField` with suggestions dropdown (like CPU), optional
- Installed at: `DatePicker` (defaults to now)
- Short-term / Long-term: `Toggle`

For the combo-box pattern (CPU + Tag): Use a `TextField` with an `.onChange` that filters the existing list, showing a `List` of matching suggestions below the field. Tapping a suggestion fills the text field. New values are allowed.

**Step 2: Create JumperSiteFormView**

Sheet for creating/editing a site:
- Name: `TextField` (required)
- Address: `TextField`
- Contact Name: `TextField`
- Contact Phone: `TextField` with `.keyboardType(.phonePad)`
- Contact Email: `TextField` with `.keyboardType(.emailAddress)`
- Notes: `TextEditor`

**Step 3: Create JumperRemoveSheet**

Confirmation sheet for removing a jumper:
- Shows jumper summary (CPU, location, reason)
- Optional removal note `TextField`
- "Remove Jumper" button (red, destructive)
- "Cancel" button

**Step 4: Commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add Datacore/Views/Jumpers/
git commit -m "feat(jumpers): add jumper form, site form, and remove sheet"
```

---

### Task 10: Apple App — Build, Verify, and Final Commit

**Files:**
- Modify: `project.yml` (if any new files need explicit inclusion — typically xcodegen auto-discovers)

**Step 1: Regenerate Xcode project**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
xcodegen generate
```

**Step 2: Build iOS target**

```bash
xcodebuild build -project Datacore.xcodeproj -scheme Datacore \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  CODE_SIGNING_ALLOWED=NO 2>&1 | grep -E "error:" | head -20
```

**Step 3: Build macOS target**

```bash
xcodebuild build -project Datacore.xcodeproj -target DatacoreMac \
  -destination 'platform=macOS' \
  CODE_SIGNING_ALLOWED=NO 2>&1 | grep -E "error:" | head -20
```

**Step 4: Fix any build errors**

Repeat builds until zero errors on both targets.

**Step 5: Ask about version bump**

Ask the user whether to increment the version number before committing.

**Step 6: Final commit**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git add -A
git commit -m "feat(jumpers): complete jumper/bypass tracking module for iOS, iPad, Mac"
```

---

### Task 11: Backend — Final Commit and Push

**Step 1: Verify all backend changes**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Personal_Database
git status
git diff --stat
```

**Step 2: Push backend**

```bash
git push origin main
```

This triggers GitHub Actions to rebuild the Docker image. After the build completes, pull the updated image in Dockge and restart the stack. The new tables will be created automatically by `db.create_all()`.

---

## File Summary

### Backend (this repo)
| Action | File |
|--------|------|
| Create | `backend/app/models/jumper.py` |
| Modify | `backend/app/models/__init__.py` |
| Modify | `backend/app/__init__.py` |
| Create | `backend/app/routes/jumpers.py` |
| Modify | `backend/app/services/scheduler.py` |

### Apple App (Datacore-Apple repo)
| Action | File |
|--------|------|
| Create | `Datacore/Models/Jumper.swift` |
| Modify | `Datacore/Models/AppModule.swift` |
| Modify | `Datacore/Network/Endpoint.swift` |
| Create | `Datacore/ViewModels/JumpersViewModel.swift` |
| Modify | `Datacore/DatacoreApp.swift` |
| Modify | `Datacore/ContentView.swift` |
| Modify | `Datacore/Views/Shared/iPadSidebar.swift` |
| Modify | `Datacore/Views/Shared/ModuleLauncherSheet.swift` |
| Modify | `Datacore/MacApp/MacSidebar.swift` |
| Modify | `Datacore/MacApp/MacModuleRouter.swift` |
| Create | `Datacore/Views/Jumpers/JumpersView.swift` |
| Create | `Datacore/Views/Jumpers/JumperSiteListView.swift` |
| Create | `Datacore/Views/Jumpers/JumperSiteDetailView.swift` |
| Create | `Datacore/Views/Jumpers/JumperRowView.swift` |
| Create | `Datacore/Views/Jumpers/JumperFormView.swift` |
| Create | `Datacore/Views/Jumpers/JumperSiteFormView.swift` |
| Create | `Datacore/Views/Jumpers/JumperRemoveSheet.swift` |
