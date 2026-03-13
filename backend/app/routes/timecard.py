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
