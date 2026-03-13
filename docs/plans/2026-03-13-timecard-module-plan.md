# Timecard Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Work Hours module with a timer-based Timecard module across Flask backend, iOS/iPad/Mac app, Apple Watch, and App Intents.

**Architecture:** Single `time_entries` table with server-side timer (NULL `end_time` = running). Flask blueprint with APScheduler forgotten-timer check. iOS module with live-updating timer display. App Intents for Focus mode automations. WidgetKit complication for Apple Watch.

**Tech Stack:** Flask/SQLAlchemy/PostgreSQL (backend), APScheduler (scheduler), SwiftUI/Swift Charts (iOS), WidgetKit (Watch complications), AppIntents framework (Shortcuts/Focus modes)

**Design Doc:** `docs/plans/2026-03-13-timecard-module-design.md`

**Key Paths:**
- Backend: `/Users/chaseburrell/Documents/VisualStudioCode/Personal_Database/backend/`
- iOS App: `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/Datacore/`
- Watch App: `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/DatacoreWatch/`
- Watch Complications: `/Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple/DatacoreWatchComplications/`

---

## Task 1: Backend — TimeEntry Model

**Files:**
- Create: `backend/app/models/timecard.py`
- Modify: `backend/app/__init__.py` (add model import + safe migrations + seed notification rules)

**Step 1: Create the TimeEntry model**

Create `backend/app/models/timecard.py`:

```python
"""
Timecard Module - Database Model

Tracks individual clock-in/clock-out time entries.
A running timer is a row with end_time=NULL.
Only one timer can be active at a time (enforced by partial unique index).
"""
from datetime import datetime, timezone

from app import db


class TimeEntry(db.Model):
    """A single clock-in/clock-out time entry."""
    __tablename__ = 'time_entries'

    id = db.Column(db.Integer, primary_key=True)
    start_time = db.Column(db.DateTime(timezone=True), nullable=False)
    end_time = db.Column(db.DateTime(timezone=True), nullable=True)
    work_type = db.Column(db.String(20), nullable=False)
    duration_seconds = db.Column(db.Integer, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    forgotten_alert_sent = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Valid work types
    TIMER_TYPES = ('in_office', 'wfh', 'support_call', 'business_travel')
    QUICK_DAY_TYPES = ('holiday', 'vacation')
    ALL_TYPES = TIMER_TYPES + QUICK_DAY_TYPES

    # Human-readable labels
    TYPE_LABELS = {
        'in_office': 'In Office',
        'wfh': 'WFH',
        'support_call': 'Support Call',
        'business_travel': 'Business Travel',
        'holiday': 'Holiday',
        'vacation': 'Vacation',
    }

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'work_type': self.work_type,
            'work_type_label': self.TYPE_LABELS.get(self.work_type, self.work_type),
            'duration_seconds': self.duration_seconds,
            'duration_display': self._format_duration(self.duration_seconds),
            'notes': self.notes,
            'forgotten_alert_sent': self.forgotten_alert_sent,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    @staticmethod
    def _format_duration(seconds):
        """Format seconds into human-readable string like '4h 12m'."""
        if seconds is None:
            return None
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        if hours > 0:
            return f"{hours}h {minutes}m"
        return f"{minutes}m"
```

**Step 2: Add model import, safe migrations, and notification rule seeding to `__init__.py`**

In `backend/app/__init__.py`:

1. Add `timecard` to the model import line (~line 100):
   ```python
   from app.models import vehicle, note, notification, maintenance_interval, folder, tag, attachment, project, kb, infrastructure, astrometrics, trek, ai_chat, work_hours, obd, debt, timecard  # noqa: F401
   ```

2. Add safe migration SQL to the `migrations` list in `_run_safe_migrations()`:
   ```python
   # Timecard: partial unique index for one active timer
   """DO $$
   BEGIN
       IF NOT EXISTS (
           SELECT 1 FROM pg_indexes WHERE indexname = 'idx_one_active_timer'
       ) THEN
           CREATE UNIQUE INDEX idx_one_active_timer ON time_entries ((TRUE)) WHERE end_time IS NULL;
       END IF;
   END $$""",

   # Timecard: index on start_time for date-range queries
   """CREATE INDEX IF NOT EXISTS idx_time_entries_start ON time_entries (start_time)""",
   ```

3. Add timecard notification rule seeding call after the debt seeding block (~line 147):
   ```python
   try:
       _seed_timecard_notification_rules(db)
   except Exception:
       pass
   ```

4. Add the `_seed_timecard_notification_rules()` function (after `_seed_debt_notification_rules()`):
   ```python
   def _seed_timecard_notification_rules(db):
       """Seed default timecard notification rules on first startup."""
       from app.models.notification import NotificationRule

       timecard_rules = [
           {
               'name': 'Clock In',
               'event_name': 'timecard.clock_in',
               'module': 'timecard',
               'description': 'When you clock in to start tracking time',
               'title_template': 'Clocked In',
               'body_template': '{{work_type_label}} at {{time}}',
           },
           {
               'name': 'Clock Out',
               'event_name': 'timecard.clock_out',
               'module': 'timecard',
               'description': 'When you clock out and stop tracking time',
               'title_template': 'Clocked Out',
               'body_template': '{{duration}} — {{work_type_label}}',
           },
           {
               'name': 'Timer Auto-Stopped',
               'event_name': 'timecard.auto_stop',
               'module': 'timecard',
               'description': 'When a running timer is auto-stopped by starting a new one',
               'title_template': 'Timer Switched',
               'body_template': 'Stopped {{old_type}} ({{old_duration}}) → Started {{new_type}}',
           },
           {
               'name': 'Quick Day Logged',
               'event_name': 'timecard.quick_day',
               'module': 'timecard',
               'description': 'When a holiday or vacation day is logged',
               'title_template': 'Day Logged',
               'body_template': '{{day_type}} — 8h recorded for {{date}}',
           },
           {
               'name': 'Forgotten Timer',
               'event_name': 'timecard.forgotten_timer',
               'module': 'timecard',
               'description': 'Alert when a timer has been running for 8+ hours',
               'title_template': 'Forgot to Clock Out?',
               'body_template': '{{work_type_label}} timer still running — {{duration}}',
           },
       ]

       for rule_data in timecard_rules:
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
                   priority='normal',
                   is_enabled=False,
               ))
       db.session.commit()
   ```

**Step 3: Commit**

```bash
git add backend/app/models/timecard.py backend/app/__init__.py
git commit -m "feat(timecard): add TimeEntry model, migrations, and notification rule seeds"
```

---

## Task 2: Backend — Core API Endpoints (start, stop, status, quick-day)

**Files:**
- Create: `backend/app/routes/timecard.py`
- Modify: `backend/app/__init__.py` (register blueprint)

**Step 1: Create the timecard routes**

Create `backend/app/routes/timecard.py`:

```python
"""
Timecard Module - API Routes

Timer-based time tracking with start/stop, status, quick-day logging,
history, stats, and entry management.

Endpoints:
  Timer:
    POST   /api/timecard/start         -> Start a timer (auto-stops running one)
    POST   /api/timecard/stop          -> Stop the running timer
    GET    /api/timecard/status        -> Current timer state

  Quick Day:
    POST   /api/timecard/quick-day     -> Log 8h holiday/vacation

  Data:
    GET    /api/timecard/history       -> Time entries for date range
    GET    /api/timecard/stats         -> Aggregated statistics for charts

  Entry Management:
    PUT    /api/timecard/entry/<id>    -> Edit a time entry
    DELETE /api/timecard/entry/<id>    -> Delete a time entry
"""
from datetime import datetime, timezone, date, timedelta

from flask import Blueprint, request, jsonify
from sqlalchemy import func, cast, Date, text

from app import db
from app.models.timecard import TimeEntry
from app.services.event_bus import emit

import pytz

timecard_bp = Blueprint('timecard', __name__)

CHICAGO_TZ = pytz.timezone('America/Chicago')


def _get_active_timer():
    """Get the currently running timer (end_time IS NULL), or None."""
    return TimeEntry.query.filter(TimeEntry.end_time.is_(None)).first()


def _stop_timer(entry, notes_override=None):
    """Stop a running timer: set end_time, compute duration."""
    now = datetime.now(timezone.utc)
    entry.end_time = now
    entry.duration_seconds = int((now - entry.start_time).total_seconds())
    if notes_override is not None:
        entry.notes = notes_override
    return entry


def _format_duration(seconds):
    """Format seconds into '4h 12m' style string."""
    if seconds is None:
        return None
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    if hours > 0:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"


def _format_time_chicago(dt):
    """Format a UTC datetime as Chicago local time string like '8:02 AM'."""
    if dt is None:
        return None
    local = dt.astimezone(CHICAGO_TZ)
    return local.strftime('%-I:%M %p')


# ═══════════════════════════════════════════════════════════════════
# Timer Endpoints
# ═══════════════════════════════════════════════════════════════════

@timecard_bp.route('/start', methods=['POST'])
def start_timer():
    """Start a new timer. Auto-stops any running timer first."""
    data = request.get_json() or {}
    work_type = data.get('work_type')

    if not work_type or work_type not in TimeEntry.TIMER_TYPES:
        return jsonify({
            'error': f'work_type must be one of: {", ".join(TimeEntry.TIMER_TYPES)}'
        }), 400

    stopped_entry = None
    active = _get_active_timer()

    if active:
        _stop_timer(active)
        stopped_entry = active
        db.session.flush()

        # Emit auto-stop event
        try:
            emit('timecard.auto_stop',
                 old_type=TimeEntry.TYPE_LABELS.get(active.work_type, active.work_type),
                 old_duration=_format_duration(active.duration_seconds),
                 new_type=TimeEntry.TYPE_LABELS.get(work_type, work_type),
                 _category='TIMECARD_CLOCK_OUT',
                 _thread_id='timecard',
                 _deep_link='datacore://timecard')
        except Exception:
            pass

    # Start new timer
    new_entry = TimeEntry(
        start_time=datetime.now(timezone.utc),
        work_type=work_type,
        notes=data.get('notes'),
    )
    db.session.add(new_entry)
    db.session.commit()

    # Emit clock-in event
    try:
        emit('timecard.clock_in',
             work_type_label=TimeEntry.TYPE_LABELS.get(work_type, work_type),
             time=_format_time_chicago(new_entry.start_time),
             _category='TIMECARD_CLOCK_OUT',
             _thread_id='timecard',
             _deep_link='datacore://timecard')
    except Exception:
        pass

    result = {'entry': new_entry.to_dict()}
    if stopped_entry:
        result['stopped_entry'] = stopped_entry.to_dict()

    return jsonify(result), 201


@timecard_bp.route('/stop', methods=['POST'])
def stop_timer():
    """Stop the currently running timer."""
    data = request.get_json() or {}

    active = _get_active_timer()
    if not active:
        return jsonify({'error': 'No timer is currently running'}), 400

    _stop_timer(active, notes_override=data.get('notes'))
    db.session.commit()

    # Emit clock-out event
    try:
        emit('timecard.clock_out',
             work_type_label=TimeEntry.TYPE_LABELS.get(active.work_type, active.work_type),
             duration=_format_duration(active.duration_seconds),
             _thread_id='timecard',
             _deep_link='datacore://timecard')
    except Exception:
        pass

    return jsonify({'entry': active.to_dict()})


@timecard_bp.route('/status', methods=['GET'])
def timer_status():
    """Get current timer state."""
    active = _get_active_timer()

    if not active:
        return jsonify({'active': False})

    now = datetime.now(timezone.utc)
    elapsed = int((now - active.start_time).total_seconds())

    return jsonify({
        'active': True,
        'entry': {
            'id': active.id,
            'work_type': active.work_type,
            'work_type_label': TimeEntry.TYPE_LABELS.get(active.work_type, active.work_type),
            'start_time': active.start_time.isoformat(),
            'elapsed_seconds': elapsed,
            'elapsed_display': _format_duration(elapsed),
            'notes': active.notes,
        },
    })


# ═══════════════════════════════════════════════════════════════════
# Quick Day
# ═══════════════════════════════════════════════════════════════════

@timecard_bp.route('/quick-day', methods=['POST'])
def quick_day():
    """Log a full 8-hour holiday or vacation day."""
    data = request.get_json() or {}
    day_type = data.get('type')

    if day_type not in TimeEntry.QUICK_DAY_TYPES:
        return jsonify({
            'error': f'type must be one of: {", ".join(TimeEntry.QUICK_DAY_TYPES)}'
        }), 400

    # Check for running timer
    if _get_active_timer():
        return jsonify({'error': 'Cannot log a quick day while a timer is running. Stop it first.'}), 409

    # Parse target date (defaults to today in Chicago)
    target_date_str = data.get('date')
    if target_date_str:
        try:
            target_date = date.fromisoformat(target_date_str)
        except ValueError:
            return jsonify({'error': 'date must be YYYY-MM-DD format'}), 400
    else:
        target_date = datetime.now(CHICAGO_TZ).date()

    # Check for duplicate holiday/vacation on that date
    day_start_utc = CHICAGO_TZ.localize(
        datetime.combine(target_date, datetime.min.time())
    ).astimezone(timezone.utc)
    day_end_utc = CHICAGO_TZ.localize(
        datetime.combine(target_date + timedelta(days=1), datetime.min.time())
    ).astimezone(timezone.utc)

    existing = TimeEntry.query.filter(
        TimeEntry.work_type.in_(TimeEntry.QUICK_DAY_TYPES),
        TimeEntry.start_time >= day_start_utc,
        TimeEntry.start_time < day_end_utc,
    ).first()

    if existing:
        return jsonify({'error': f'A {existing.work_type} day is already logged for {target_date.isoformat()}'}), 409

    # Create completed 8-hour entry
    # Place it at 9 AM - 5 PM Chicago time for that date
    start_local = CHICAGO_TZ.localize(
        datetime.combine(target_date, datetime.min.time().replace(hour=9))
    )
    end_local = start_local + timedelta(hours=8)

    entry = TimeEntry(
        start_time=start_local.astimezone(timezone.utc),
        end_time=end_local.astimezone(timezone.utc),
        work_type=day_type,
        duration_seconds=28800,  # 8 hours
        notes=data.get('notes'),
    )
    db.session.add(entry)
    db.session.commit()

    # Emit event
    try:
        emit('timecard.quick_day',
             day_type=TimeEntry.TYPE_LABELS.get(day_type, day_type),
             date=target_date.strftime('%b %-d'),
             _thread_id='timecard',
             _deep_link='datacore://timecard')
    except Exception:
        pass

    return jsonify({'entry': entry.to_dict()}), 201


# ═══════════════════════════════════════════════════════════════════
# Data Endpoints
# ═══════════════════════════════════════════════════════════════════

@timecard_bp.route('/history', methods=['GET'])
def get_history():
    """Get time entries for a date range."""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    work_type = request.args.get('work_type')

    query = TimeEntry.query.filter(TimeEntry.end_time.isnot(None))

    if start_date:
        try:
            start = date.fromisoformat(start_date)
            start_utc = CHICAGO_TZ.localize(
                datetime.combine(start, datetime.min.time())
            ).astimezone(timezone.utc)
            query = query.filter(TimeEntry.start_time >= start_utc)
        except ValueError:
            return jsonify({'error': 'start_date must be YYYY-MM-DD'}), 400

    if end_date:
        try:
            end = date.fromisoformat(end_date)
            end_utc = CHICAGO_TZ.localize(
                datetime.combine(end + timedelta(days=1), datetime.min.time())
            ).astimezone(timezone.utc)
            query = query.filter(TimeEntry.start_time < end_utc)
        except ValueError:
            return jsonify({'error': 'end_date must be YYYY-MM-DD'}), 400

    if work_type:
        query = query.filter(TimeEntry.work_type == work_type)

    entries = query.order_by(TimeEntry.start_time.desc()).all()
    return jsonify([e.to_dict() for e in entries])


@timecard_bp.route('/stats', methods=['GET'])
def get_stats():
    """Get aggregated statistics for charts."""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if not start_date or not end_date:
        return jsonify({'error': 'start_date and end_date are required'}), 400

    try:
        start = date.fromisoformat(start_date)
        end = date.fromisoformat(end_date)
    except ValueError:
        return jsonify({'error': 'dates must be YYYY-MM-DD'}), 400

    start_utc = CHICAGO_TZ.localize(
        datetime.combine(start, datetime.min.time())
    ).astimezone(timezone.utc)
    end_utc = CHICAGO_TZ.localize(
        datetime.combine(end + timedelta(days=1), datetime.min.time())
    ).astimezone(timezone.utc)

    # Get all completed entries in range
    entries = TimeEntry.query.filter(
        TimeEntry.end_time.isnot(None),
        TimeEntry.start_time >= start_utc,
        TimeEntry.start_time < end_utc,
    ).all()

    # Totals by work type
    type_totals = {}
    for e in entries:
        if e.work_type not in type_totals:
            type_totals[e.work_type] = {'total_seconds': 0, 'count': 0}
        type_totals[e.work_type]['total_seconds'] += (e.duration_seconds or 0)
        type_totals[e.work_type]['count'] += 1

    totals_by_type = []
    for wt, data in type_totals.items():
        total_hours = data['total_seconds'] / 3600
        days = data['count']
        totals_by_type.append({
            'work_type': wt,
            'work_type_label': TimeEntry.TYPE_LABELS.get(wt, wt),
            'total_hours': round(total_hours, 2),
            'total_days': days,
            'avg_hours_per_day': round(total_hours / days, 2) if days > 0 else 0,
        })

    # Daily breakdown (for stacked bar charts)
    daily = {}
    for e in entries:
        # Convert start_time to Chicago date
        local_date = e.start_time.astimezone(CHICAGO_TZ).date().isoformat()
        key = (local_date, e.work_type)
        if key not in daily:
            daily[key] = 0
        daily[key] += (e.duration_seconds or 0)

    daily_breakdown = [
        {
            'date': d,
            'work_type': wt,
            'work_type_label': TimeEntry.TYPE_LABELS.get(wt, wt),
            'hours': round(secs / 3600, 2),
        }
        for (d, wt), secs in sorted(daily.items())
    ]

    # Weekly averages
    weekly = {}
    for (d, wt), secs in daily.items():
        entry_date = date.fromisoformat(d)
        # Monday of that week
        week_start = entry_date - timedelta(days=entry_date.weekday())
        week_key = week_start.isoformat()
        if week_key not in weekly:
            weekly[week_key] = {'total_seconds': 0, 'days': set()}
        weekly[week_key]['total_seconds'] += secs
        weekly[week_key]['days'].add(d)

    weekly_averages = [
        {
            'week_start': ws,
            'total_hours': round(data['total_seconds'] / 3600, 2),
            'avg_hours': round((data['total_seconds'] / 3600) / max(len(data['days']), 1), 2),
        }
        for ws, data in sorted(weekly.items())
    ]

    return jsonify({
        'totals_by_type': totals_by_type,
        'daily_breakdown': daily_breakdown,
        'weekly_averages': weekly_averages,
    })


# ═══════════════════════════════════════════════════════════════════
# Entry Management
# ═══════════════════════════════════════════════════════════════════

@timecard_bp.route('/entry/<int:entry_id>', methods=['PUT'])
def update_entry(entry_id):
    """Edit a time entry for manual corrections."""
    entry = TimeEntry.query.get_or_404(entry_id)
    data = request.get_json() or {}

    if 'work_type' in data:
        if data['work_type'] not in TimeEntry.ALL_TYPES:
            return jsonify({'error': f'Invalid work_type'}), 400
        entry.work_type = data['work_type']

    if 'notes' in data:
        entry.notes = data['notes']

    if 'start_time' in data:
        try:
            entry.start_time = datetime.fromisoformat(data['start_time'])
        except ValueError:
            return jsonify({'error': 'Invalid start_time format'}), 400

    if 'end_time' in data:
        if data['end_time'] is None:
            entry.end_time = None
            entry.duration_seconds = None
        else:
            try:
                entry.end_time = datetime.fromisoformat(data['end_time'])
            except ValueError:
                return jsonify({'error': 'Invalid end_time format'}), 400

    # Recalculate duration if both times are set
    if entry.start_time and entry.end_time:
        entry.duration_seconds = int((entry.end_time - entry.start_time).total_seconds())

    db.session.commit()
    return jsonify(entry.to_dict())


@timecard_bp.route('/entry/<int:entry_id>', methods=['DELETE'])
def delete_entry(entry_id):
    """Delete a time entry."""
    entry = TimeEntry.query.get_or_404(entry_id)
    db.session.delete(entry)
    db.session.commit()
    return jsonify({'deleted': True})
```

**Step 2: Register the blueprint in `__init__.py`**

Add after the debts blueprint registration (~line 90):

```python
from app.routes.timecard import timecard_bp
app.register_blueprint(timecard_bp, url_prefix='/api/timecard')
```

**Step 3: Add `pytz` to requirements.txt if not already present**

Check `backend/requirements.txt` for `pytz`. If missing, add it.

**Step 4: Add timecard events to AVAILABLE_EVENTS in `notifications.py`**

In `backend/app/routes/notifications.py`, add to the `AVAILABLE_EVENTS` list:

```python
# Timecard
{
    'name': 'timecard.clock_in',
    'module': 'timecard',
    'description': 'When you clock in to start tracking time',
    'fields': ['work_type_label', 'time'],
},
{
    'name': 'timecard.clock_out',
    'module': 'timecard',
    'description': 'When you clock out and stop tracking time',
    'fields': ['work_type_label', 'duration'],
},
{
    'name': 'timecard.auto_stop',
    'module': 'timecard',
    'description': 'When a running timer is auto-stopped by starting a new one',
    'fields': ['old_type', 'old_duration', 'new_type'],
},
{
    'name': 'timecard.quick_day',
    'module': 'timecard',
    'description': 'When a holiday or vacation day is logged',
    'fields': ['day_type', 'date'],
},
{
    'name': 'timecard.forgotten_timer',
    'module': 'timecard',
    'description': 'Alert when a timer has been running for 8+ hours',
    'fields': ['work_type_label', 'duration'],
},
```

**Step 5: Commit**

```bash
git add backend/app/routes/timecard.py backend/app/__init__.py backend/app/routes/notifications.py
git commit -m "feat(timecard): add Flask API endpoints and notification events"
```

---

## Task 3: Backend — Forgotten Timer Scheduler Job

**Files:**
- Modify: `backend/app/services/scheduler.py`

**Step 1: Add the forgotten timer job**

Add two functions to `scheduler.py` and call `_add_timecard_forgotten_timer_job()` from `init_scheduler()`:

1. In `init_scheduler()`, add to the job registration block (~after `_add_debt_autopay_job()`):
   ```python
   _add_timecard_forgotten_timer_job()
   ```

2. Add the job functions at the end of the file:
   ```python
   # ═══════════════════════════════════════════════════════════════════════════
   # Timecard Forgotten Timer Check
   # ═══════════════════════════════════════════════════════════════════════════

   def _add_timecard_forgotten_timer_job():
       """Add an hourly job to check for timers running 8+ hours."""
       global scheduler
       if not scheduler:
           return

       scheduler.add_job(
           _check_forgotten_timers,
           trigger='interval',
           id='timecard_forgotten_timer_check',
           hours=1,
           replace_existing=True,
       )
       logger.info("Timecard forgotten timer check scheduled (hourly)")


   def _check_forgotten_timers():
       """Check for timers running 8+ hours and send forgotten-timer notification."""
       global _app
       if not _app:
           return

       with _app.app_context():
           from app import db
           from app.models.timecard import TimeEntry
           from app.services.event_bus import emit

           try:
               cutoff = datetime.now(timezone.utc) - timedelta(hours=8)

               forgotten = TimeEntry.query.filter(
                   TimeEntry.end_time.is_(None),
                   TimeEntry.start_time < cutoff,
                   TimeEntry.forgotten_alert_sent == False,  # noqa: E712
               ).all()

               for entry in forgotten:
                   elapsed = int((datetime.now(timezone.utc) - entry.start_time).total_seconds())
                   try:
                       emit('timecard.forgotten_timer',
                            work_type_label=TimeEntry.TYPE_LABELS.get(entry.work_type, entry.work_type),
                            duration=TimeEntry._format_duration(elapsed),
                            _category='TIMECARD_CLOCK_OUT',
                            _thread_id='timecard',
                            _deep_link='datacore://timecard',
                            _interruption_level='time-sensitive')
                   except Exception:
                       pass

                   entry.forgotten_alert_sent = True

               if forgotten:
                   db.session.commit()
                   logger.info(f"Timecard: sent forgotten-timer alerts for {len(forgotten)} entry(ies)")

           except Exception as e:
               db.session.rollback()
               logger.error(f"Timecard forgotten timer check failed: {e}")
   ```

**Step 2: Commit**

```bash
git add backend/app/services/scheduler.py
git commit -m "feat(timecard): add hourly forgotten timer scheduler job (8h threshold)"
```

---

## Task 4: Backend — Remove Old Work Hours Module

**Files:**
- Delete: `backend/app/routes/work_hours.py`
- Delete: `backend/app/models/work_hours.py`
- Modify: `backend/app/__init__.py` (remove work_hours blueprint + import)

**Step 1: Remove work_hours blueprint registration from `__init__.py`**

Remove these lines:
```python
from app.routes.work_hours import work_hours_bp
app.register_blueprint(work_hours_bp, url_prefix='/api/work-hours')
```

Remove `work_hours` from the model import line (but keep `timecard`).

**Step 2: Delete the files**

```bash
rm backend/app/routes/work_hours.py
rm backend/app/models/work_hours.py
```

**Step 3: Commit**

```bash
git add -A backend/app/routes/work_hours.py backend/app/models/work_hours.py backend/app/__init__.py
git commit -m "refactor(timecard): remove old Work Hours module (replaced by Timecard)"
```

---

## Task 5: iOS — Models and Endpoint Cases

**Files:**
- Create: `Datacore/Models/TimeEntry.swift`
- Create: `Datacore/Models/TimecardStatus.swift`
- Create: `Datacore/Models/TimecardStats.swift`
- Modify: `Datacore/Network/Endpoint.swift` (add timecard cases, remove work hours cases)

**Step 1: Create Codable models**

`Datacore/Models/TimeEntry.swift`:
```swift
import Foundation

struct TimeEntry: Codable, Identifiable, Sendable {
    let id: Int
    let startTime: Date?
    let endTime: Date?
    let workType: String
    let workTypeLabel: String
    let durationSeconds: Int?
    let durationDisplay: String?
    let notes: String?
    let forgottenAlertSent: Bool?
    let createdAt: String?
}
```

`Datacore/Models/TimecardStatus.swift`:
```swift
import Foundation

struct TimecardStatus: Codable, Sendable {
    let active: Bool
    let entry: TimecardStatusEntry?
}

struct TimecardStatusEntry: Codable, Sendable {
    let id: Int
    let workType: String
    let workTypeLabel: String
    let startTime: String
    let elapsedSeconds: Int
    let elapsedDisplay: String
    let notes: String?
}
```

`Datacore/Models/TimecardStats.swift`:
```swift
import Foundation

struct TimecardStats: Codable, Sendable {
    let totalsByType: [TimecardTypeSummary]
    let dailyBreakdown: [TimecardDailyEntry]
    let weeklyAverages: [TimecardWeeklyEntry]
}

struct TimecardTypeSummary: Codable, Identifiable, Sendable {
    var id: String { workType }
    let workType: String
    let workTypeLabel: String
    let totalHours: Double
    let totalDays: Int
    let avgHoursPerDay: Double
}

struct TimecardDailyEntry: Codable, Identifiable, Sendable {
    var id: String { "\(date)-\(workType)" }
    let date: String
    let workType: String
    let workTypeLabel: String
    let hours: Double
}

struct TimecardWeeklyEntry: Codable, Identifiable, Sendable {
    var id: String { weekStart }
    let weekStart: String
    let totalHours: Double
    let avgHours: Double
}

/// Response wrapper for start endpoint
struct TimecardStartResponse: Codable, Sendable {
    let entry: TimeEntry
    let stoppedEntry: TimeEntry?
}

/// Response wrapper for stop endpoint
struct TimecardStopResponse: Codable, Sendable {
    let entry: TimeEntry
}
```

**Step 2: Update `Endpoint.swift`**

Remove the Work Hours cases:
```swift
// Remove these:
case workHoursYears
case workHoursYear(year: Int)
case workHoursUpdateMonth(year: Int, month: Int)
case workHoursSummary(year: Int)
```

Remove their `path` entries and add:

```swift
// MARK: - Timecard
case timecardStart
case timecardStop
case timecardStatus
case timecardQuickDay
case timecardHistory
case timecardStats
case timecardEntry(id: Int)
```

Add path mappings:
```swift
// Timecard
case .timecardStart:                           return "/api/timecard/start"
case .timecardStop:                            return "/api/timecard/stop"
case .timecardStatus:                          return "/api/timecard/status"
case .timecardQuickDay:                        return "/api/timecard/quick-day"
case .timecardHistory:                         return "/api/timecard/history"
case .timecardStats:                           return "/api/timecard/stats"
case .timecardEntry(let id):                   return "/api/timecard/entry/\(id)"
```

**Step 3: Commit**

```bash
git add Datacore/Models/TimeEntry.swift Datacore/Models/TimecardStatus.swift Datacore/Models/TimecardStats.swift Datacore/Network/Endpoint.swift
git commit -m "feat(timecard): add iOS models and Endpoint cases"
```

---

## Task 6: iOS — ViewModel

**Files:**
- Create: `Datacore/ViewModels/TimecardViewModel.swift`
- Delete: `Datacore/ViewModels/WorkHoursViewModel.swift`

**Step 1: Create TimecardViewModel**

Create `Datacore/ViewModels/TimecardViewModel.swift` following the `@Observable @MainActor` pattern from existing view models. Key responsibilities:

- `status: TimecardStatus?` — current timer state from `/status`
- `serverStartTime: Date?` — parsed from status for local elapsed calculation
- `history: [TimeEntry]` — recent entries from `/history`
- `stats: TimecardStats?` — chart data from `/stats`
- `isLoading`, `error: APIError?` — standard loading state
- `loadStatus()` — GET `/status`
- `startTimer(workType:)` — POST `/start`
- `stopTimer()` — POST `/stop`
- `logQuickDay(type:date:)` — POST `/quick-day`
- `loadHistory(startDate:endDate:workType:)` — GET `/history`
- `loadStats(startDate:endDate:)` — GET `/stats`
- `updateEntry(id:...)` — PUT `/entry/<id>`
- `deleteEntry(id:)` — DELETE `/entry/<id>`
- Silent 60-second auto-refresh of status via `silentRefreshTask`

**Step 2: Delete old WorkHoursViewModel**

```bash
rm Datacore/ViewModels/WorkHoursViewModel.swift
```

**Step 3: Commit**

```bash
git add Datacore/ViewModels/TimecardViewModel.swift
git add -A Datacore/ViewModels/WorkHoursViewModel.swift
git commit -m "feat(timecard): add TimecardViewModel, remove WorkHoursViewModel"
```

---

## Task 7: iOS — Navigation Updates (AppModule, Sidebars, ContentView, EnvironmentInjector)

**Files:**
- Modify: `Datacore/Models/AppModule.swift` (replace `.workHours` with `.timecard`)
- Modify: `Datacore/Views/Shared/iPadSidebar.swift`
- Modify: `Datacore/MacApp/MacSidebar.swift`
- Modify: `Datacore/ContentView.swift` (MoreView, selectedModuleView, iPadNavigationSplitView)
- Modify: `Datacore/MacApp/MacModuleRouter.swift`
- Modify: `Datacore/Views/Shared/EnvironmentInjector.swift` (replace workHoursVM with timecardVM)
- Modify: `Datacore/Views/Shared/ControlPill.swift` (replace WorkHoursViewModel reference)
- Modify: `Datacore/DatacoreApp.swift` and `Datacore/MacApp/MacDatacoreApp.swift` (replace WorkHoursViewModel instantiation with TimecardViewModel)

**Step 1: Update `AppModule.swift`**

Replace `.workHours` with `.timecard`:
```swift
case timecard
```
Update the title:
```swift
case .timecard: "Timecard"
```

**Step 2: Update sidebars**

In both `iPadSidebar.swift` and `MacSidebar.swift`, replace:
```swift
sidebarRow(.workHours, icon: "clock.fill", label: "Work Hours")
```
with:
```swift
sidebarRow(.timecard, icon: "clock.badge.checkmark", label: "Timecard")
```

**Step 3: Update ContentView.swift**

In `selectedModuleView()`, replace:
```swift
case .workHours:
    WorkHoursView()
```
with:
```swift
case .timecard:
    TimecardView()
```

In `MoreView`, replace the Work Hours NavigationLink with Timecard:
```swift
NavigationLink {
    TimecardView()
} label: {
    Label("Timecard", systemImage: "clock.badge.checkmark")
}
```

**Step 4: Update MacModuleRouter.swift**

Replace:
```swift
case .workHours:
    MacWorkHoursView()
```
with:
```swift
case .timecard:
    TimecardView()
```

**Step 5: Update EnvironmentInjector.swift**

Replace `workHoursVM: WorkHoursViewModel` with `timecardVM: TimecardViewModel` in both the property declaration and the `.environment()` call.

**Step 6: Update ControlPill.swift**

Replace `@Environment(WorkHoursViewModel.self) private var workHoursVM` with `@Environment(TimecardViewModel.self) private var timecardVM`. Update any references within the file.

**Step 7: Update DatacoreApp.swift and MacDatacoreApp.swift**

Replace `WorkHoursViewModel()` instantiation with `TimecardViewModel()` and update the EnvironmentInjector parameter name.

**Step 8: Commit**

```bash
git add -A
git commit -m "refactor(timecard): replace workHours with timecard in navigation and environment"
```

---

## Task 8: iOS — Delete Old Work Hours Views

**Files:**
- Delete: `Datacore/Views/WorkHours/WorkHoursView.swift`
- Delete: `Datacore/Views/WorkHours/WorkHoursMonthRow.swift`
- Delete: `Datacore/Views/WorkHours/WorkHoursEditSheet.swift`
- Delete: `Datacore/MacApp/Modules/MacWorkHoursView.swift`

**Step 1: Delete files**

```bash
rm -rf Datacore/Views/WorkHours/
rm Datacore/MacApp/Modules/MacWorkHoursView.swift
```

**Step 2: Commit**

```bash
git add -A
git commit -m "refactor(timecard): remove old Work Hours views"
```

---

## Task 9: iOS — Timecard Views (Dashboard, History, Stats, Entry Form)

**Files:**
- Create: `Datacore/Views/Timecard/TimecardView.swift`
- Create: `Datacore/Views/Timecard/TimecardDashboardTab.swift`
- Create: `Datacore/Views/Timecard/TimecardHistoryTab.swift`
- Create: `Datacore/Views/Timecard/TimecardStatsTab.swift`
- Create: `Datacore/Views/Timecard/TimecardEntryForm.swift`

**Implementation notes:**

- `TimecardView`: Root view with segmented picker (Dashboard / History / Statistics). Uses `@Environment(\.horizontalSizeClass)` for iPad/Mac vs iPhone branching. On iPad/Mac, show dashboard and history side-by-side instead of tabbed.

- `TimecardDashboardTab`:
  - Live timer display using `TimelineView(.periodic(from: .now, by: 1))` counting from `vm.serverStartTime`
  - Quick action buttons for each work type (4 clock-in buttons, clock out, holiday, vacation)
  - Today's summary showing hours by type with color bars
  - Current week Mon-Fri overview with color-coded daily totals
  - Work type colors: `.orange` (office), `.blue` (WFH), `.red` (support), `.purple` (travel), `.green` (holiday), `.teal` (vacation)

- `TimecardHistoryTab`:
  - Entries grouped by date using `Dictionary(grouping:)`
  - Each entry shows: color dot, work type, start–end times, duration
  - Swipe to delete, tap to edit (presents `TimecardEntryForm` sheet)
  - Date range picker at top

- `TimecardStatsTab`:
  - `import Charts` for Swift Charts
  - Monthly hours bar chart (stacked by work type)
  - Work type distribution donut chart
  - Weekly total hours trend line
  - Date range picker controlling the data

- `TimecardEntryForm`:
  - Sheet for editing entries
  - DatePickers for start/end time
  - Picker for work type
  - TextField for notes
  - `onSubmit` callback pattern (parent handles API call)

**Step 1: Create all 5 view files**

Follow the patterns from existing modules (WorkHoursView, DebtView) for structure, using `.platformNavTitleDisplayMode()`, `.refreshable`, `.task`, `.onReceive(.datacoreRefresh)`.

**Step 2: Commit**

```bash
git add Datacore/Views/Timecard/
git commit -m "feat(timecard): add iOS Timecard views (dashboard, history, stats, entry form)"
```

---

## Task 10: iOS — Notification Category + Actionable Handler

**Files:**
- Modify: `Datacore/Network/PushNotificationManager.swift`

**Step 1: Register `TIMECARD_CLOCK_OUT` category**

In `registerCategories()`, add:

```swift
let clockOutAction = UNNotificationAction(
    identifier: "CLOCK_OUT",
    title: "Clock Out",
    options: []  // No .foreground — runs in background
)

let timecardClockOut = UNNotificationCategory(
    identifier: "TIMECARD_CLOCK_OUT",
    actions: [clockOutAction],
    intentIdentifiers: []
)
```

Add `timecardClockOut` to the `setNotificationCategories` array.

**Step 2: Handle the action in `didReceive response`**

In the `userNotificationCenter(_:didReceive:)` delegate method, add handling:

```swift
if actionId == "CLOCK_OUT" {
    pushLog.info("🔔 Clock Out action triggered from notification")
    Task {
        do {
            let _: TimecardStopResponse = try await APIClient.shared.post(.timecardStop, body: EmptyBody())
            pushLog.info("🔔 Clock Out via notification succeeded")
        } catch {
            pushLog.error("🔔 Clock Out via notification failed: \(error)")
        }
    }
    return
}
```

**Step 3: Commit**

```bash
git add Datacore/Network/PushNotificationManager.swift
git commit -m "feat(timecard): add TIMECARD_CLOCK_OUT actionable notification category"
```

---

## Task 11: iOS — App Intents (8 intents)

**Files:**
- Create: `Datacore/AppIntents/ClockInOfficeIntent.swift`
- Create: `Datacore/AppIntents/ClockInWFHIntent.swift`
- Create: `Datacore/AppIntents/ClockInSupportCallIntent.swift`
- Create: `Datacore/AppIntents/ClockInBusinessTravelIntent.swift`
- Create: `Datacore/AppIntents/ClockOutIntent.swift`
- Create: `Datacore/AppIntents/TimecardStatusIntent.swift`
- Create: `Datacore/AppIntents/LogHolidayIntent.swift`
- Create: `Datacore/AppIntents/LogVacationIntent.swift`
- Modify: `DatacoreWatch/AppIntents/DatacoreShortcuts.swift` (add timecard shortcuts)

**Implementation pattern** (example for `ClockInOfficeIntent`):

```swift
import AppIntents
import Foundation

struct ClockInOfficeIntent: AppIntent {
    static let title: LocalizedStringResource = "Clock In — Office"
    static let description: IntentDescription = "Start tracking time as In Office."
    static let openAppWhenRun = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        struct StartBody: Encodable, Sendable {
            let workType: String
        }

        do {
            let _: TimecardStartResponse = try await APIClient.shared.post(
                .timecardStart,
                body: StartBody(workType: "in_office")
            )
            return .result(dialog: "Clocked in — In Office")
        } catch {
            return .result(dialog: "Failed to clock in. Check your server connection.")
        }
    }
}
```

Each clock-in intent follows the same pattern with a different `workType` value. `ClockOutIntent` calls `.timecardStop`. `TimecardStatusIntent` calls `.timecardStatus` and displays the result. `LogHolidayIntent` and `LogVacationIntent` call `.timecardQuickDay`.

**Add to DatacoreShortcuts.swift** — register all 8 intents as `AppShortcut` entries with appropriate phrases.

**Step 1: Create all 8 intent files**

**Step 2: Update DatacoreShortcuts.swift**

**Step 3: Commit**

```bash
git add Datacore/AppIntents/ DatacoreWatch/AppIntents/DatacoreShortcuts.swift
git commit -m "feat(timecard): add 8 App Intents for Focus mode automations"
```

---

## Task 12: Apple Watch — Complication

**Files:**
- Create: `DatacoreWatchComplications/TimecardComplication.swift`

**Implementation:**

Follow the `LaunchCountdownComplication.swift` pattern exactly:

- `TimecardTimelineEntry: TimelineEntry` with `date`, `isActive`, `workType`, `workTypeAbbrev`, `startTime`, `isPlaceholder`
- `TimecardProvider: TimelineProvider` that fetches from `WatchAPIClient.shared.get(.timecardStatus)`
- Cache result in `WatchDataCache.timecardStatus`
- Forward entries every 30 minutes over 4 hours
- **Circular:** Play/stop icon + abbreviation (OFC, WFH, SUP, TRV)
- **Rectangular:** `Text(startTime, style: .timer)` for live elapsed, or "Not Clocked In"
- **Inline:** "Working: WFH" or "Not Clocked In"
- Register as `TimecardWidget: Widget` with supported families: `.accessoryCircular`, `.accessoryRectangular`, `.accessoryInline`

**Step 1: Create the complication file**

**Step 2: Commit**

```bash
git add DatacoreWatchComplications/TimecardComplication.swift
git commit -m "feat(timecard): add Apple Watch WidgetKit complication"
```

---

## Task 13: Apple Watch — Detail View and WatchEndpoint

**Files:**
- Create: `DatacoreWatch/Views/TimecardDetailView.swift`
- Modify: `DatacoreWatch/Network/WatchEndpoint.swift` (add `.timecardStatus`, `.timecardStart`, `.timecardStop`)
- Modify: `DatacoreWatch/ViewModels/WatchViewModel.swift` (add timecard loader)
- Modify: `DatacoreWatch/Cache/WatchDataCache.swift` (add timecard cache)
- Modify: `DatacoreWatch/ContentView.swift` (add timecard tile)

**Step 1: Add WatchEndpoint cases**

```swift
case timecardStatus     // GET /api/timecard/status
case timecardStart      // POST /api/timecard/start
case timecardStop       // POST /api/timecard/stop
```

Path mappings:
```swift
case .timecardStatus: return "/api/timecard/status"
case .timecardStart:  return "/api/timecard/start"
case .timecardStop:   return "/api/timecard/stop"
```

**Step 2: Add WatchDataCache property for timecard status**

**Step 3: Add timecard loader to WatchViewModel**

**Step 4: Create TimecardDetailView** — Shows current status with live timer, Clock Out button, and today's summary.

**Step 5: Add timecard tile to Watch ContentView** — Navigation tile between launch and settings tiles.

**Step 6: Commit**

```bash
git add DatacoreWatch/
git commit -m "feat(timecard): add Apple Watch detail view and endpoint"
```

---

## Task 14: XcodeGen + Build Verification

**Files:**
- Modify: `project.yml` (add new files to targets, remove old Work Hours files)

**Step 1: Update project.yml**

Add all new Swift files to the appropriate targets. Remove references to deleted Work Hours files.

**Step 2: Regenerate and build**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
xcodegen generate

# Build iOS
xcodebuild build -project Datacore.xcodeproj -scheme Datacore \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  CODE_SIGNING_ALLOWED=NO 2>&1 | grep -E "error:" | head -20

# Build macOS
xcodebuild build -project Datacore.xcodeproj -target DatacoreMac \
  -destination 'platform=macOS' \
  CODE_SIGNING_ALLOWED=NO 2>&1 | grep -E "error:" | head -20
```

**Step 3: Fix any errors and rebuild until clean**

**Step 4: Ask about version bump**

**Step 5: Commit**

```bash
git add project.yml
git commit -m "build: update XcodeGen project for Timecard module"
```

---

## Task 15: Final — Push and Deploy

**Step 1: Push backend changes**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Personal_Database
git push origin main
```

Wait for GitHub Actions to build the Docker image.

**Step 2: Push iOS changes**

```bash
cd /Users/chaseburrell/Documents/VisualStudioCode/Datacore-Apple
git push origin main
```

**Step 3: Deploy backend**

In Dockge, pull latest images and restart the `life-hub-main` stack.

**Step 4: Verify**

```bash
# Check backend starts cleanly
docker logs life-hub-main-backend-1 --tail 50

# Test status endpoint
curl http://<server>/api/timecard/status

# Test start endpoint
curl -X POST http://<server>/api/timecard/start \
  -H 'Content-Type: application/json' \
  -d '{"work_type": "wfh"}'
```
