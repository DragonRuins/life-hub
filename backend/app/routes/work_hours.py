"""
Work Hours Module - API Routes

Tracks monthly hours worked against a standard 40-hour work week.
Uses lazy year creation: first access to a year auto-creates all 12 months.

Endpoints:
  GET  /api/work-hours/years              -> list of available years
  GET  /api/work-hours/<year>             -> all 12 months for a year
  PUT  /api/work-hours/<year>/<month>     -> update hours_worked for a month
  GET  /api/work-hours/summary/<year>     -> year totals and aggregates
"""
from datetime import datetime

from flask import Blueprint, request, jsonify

from app import db
from app.models.work_hours import WorkHoursLog

work_hours_bp = Blueprint('work_hours', __name__)


def _ensure_year(year):
    """
    Ensure all 12 months exist for the given year.

    Queries existing records and creates any missing months with
    hours_worked=None. This is idempotent — safe to call repeatedly.
    """
    existing = WorkHoursLog.query.filter_by(year=year).all()
    existing_months = {r.month for r in existing}

    for month in range(1, 13):
        if month not in existing_months:
            db.session.add(WorkHoursLog(year=year, month=month))

    if len(existing_months) < 12:
        db.session.commit()


# ── Available Years ──────────────────────────────────────────

@work_hours_bp.route('/years', methods=['GET'])
def get_years():
    """
    Return a sorted list of years that have records,
    always including the current year.
    """
    current_year = datetime.now().year

    # Get distinct years from the database
    rows = db.session.query(WorkHoursLog.year).distinct().all()
    years = {row[0] for row in rows}

    # Always include the current year and 2025 (first year with full data)
    years.add(current_year)
    years.add(2025)

    return jsonify(sorted(years, reverse=True))


# ── Year Data ────────────────────────────────────────────────

@work_hours_bp.route('/<int:year>', methods=['GET'])
def get_year(year):
    """
    Return all 12 months for the given year, sorted by month.
    Lazily creates the year's records on first access.

    Rejects years before 2025 as invalid.
    """
    if year < 2025:
        return jsonify({'error': 'Year must be 2025 or later'}), 400

    _ensure_year(year)

    months = (
        WorkHoursLog.query
        .filter_by(year=year)
        .order_by(WorkHoursLog.month)
        .all()
    )

    return jsonify([m.to_dict() for m in months])


# ── Update Month ─────────────────────────────────────────────

@work_hours_bp.route('/<int:year>/<int:month>', methods=['PUT'])
def update_month(year, month):
    """
    Update hours_worked for a specific month.

    Accepts JSON: {"hours_worked": 168.5} or {"hours_worked": null}
    Setting to null clears the entry (marks as "not yet entered").
    """
    # Validate month range
    if month < 1 or month > 12:
        return jsonify({'error': 'Month must be between 1 and 12'}), 400

    data = request.get_json()
    if data is None:
        return jsonify({'error': 'JSON body required'}), 400

    if 'hours_worked' not in data:
        return jsonify({'error': 'hours_worked field is required'}), 400

    hours_worked = data['hours_worked']

    # Allow null to clear the entry
    if hours_worked is not None:
        try:
            hours_worked = float(hours_worked)
        except (ValueError, TypeError):
            return jsonify({'error': 'hours_worked must be a number or null'}), 400

        if hours_worked < 0:
            return jsonify({'error': 'hours_worked cannot be negative'}), 400

    # Ensure the year exists, then find the record
    _ensure_year(year)

    record = WorkHoursLog.query.filter_by(year=year, month=month).first()
    if not record:
        return jsonify({'error': 'Month record not found'}), 404

    record.hours_worked = hours_worked
    db.session.commit()

    return jsonify(record.to_dict())


# ── Year Summary ─────────────────────────────────────────────

@work_hours_bp.route('/summary/<int:year>', methods=['GET'])
def get_summary(year):
    """
    Return aggregate stats for a year:
    - total_hours: sum of all entered hours_worked
    - total_required: sum of required_hours across entered months
    - total_overtime: total_hours - total_required (can be negative)
    - months_entered: count of months with hours_worked != null
    - months: full month data array
    """
    _ensure_year(year)

    months = (
        WorkHoursLog.query
        .filter_by(year=year)
        .order_by(WorkHoursLog.month)
        .all()
    )

    month_dicts = [m.to_dict() for m in months]

    # Only aggregate months that have been entered
    entered = [m for m in month_dicts if m['hours_worked'] is not None]

    total_hours = sum(m['hours_worked'] for m in entered)
    total_required = sum(m['required_hours'] for m in entered)
    total_overtime = round(total_hours - total_required, 2)

    return jsonify({
        'year': year,
        'total_hours': round(total_hours, 2),
        'total_required': total_required,
        'total_overtime': total_overtime,
        'months_entered': len(entered),
        'months': month_dicts,
    })
