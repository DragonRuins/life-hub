"""
Maintenance Interval Checker

Core logic for determining whether a vehicle's maintenance intervals are
due, due soon, or overdue, and for emitting notification events when
overdue milestones are reached.

Three public functions:
  - check_interval_status(): Pure function that computes status for one interval
  - check_and_notify_intervals(): Check all intervals for one vehicle, emit events
  - check_all_vehicle_intervals(): Check every vehicle (called by daily scheduler)

The status lifecycle:
  "ok" -> "due_soon" -> "due" -> "overdue"
  Once serviced (last_service_date/mileage reset), the cycle restarts and
  notified_milestones is cleared.
"""
import logging
import time
from datetime import date, datetime, timedelta, timezone

from app import db
from app.models.vehicle import Vehicle
from app.models.maintenance_interval import VehicleMaintenanceInterval

logger = logging.getLogger(__name__)

# Try to use dateutil for accurate month math (handles 28/30/31-day months).
# Falls back to approximation (months * 30 days) if dateutil isn't installed.
try:
    from dateutil.relativedelta import relativedelta
    HAS_DATEUTIL = True
except ImportError:
    HAS_DATEUTIL = False


# ---------------------------------------------------------------------------
# 1. Pure status computation
# ---------------------------------------------------------------------------

def check_interval_status(interval, current_mileage, current_date=None):
    """
    Calculate how close a maintenance interval is to being due.

    This is a pure function — it reads data from the interval object but
    does NOT modify anything or touch the database.

    Args:
        interval: A VehicleMaintenanceInterval model instance.
        current_mileage: The vehicle's current odometer reading (int).
        current_date: Optional date to use as "today" (defaults to date.today()).
                      Useful for testing with a fixed date.

    Returns:
        A dict with status info:
        {
            "status": "ok" | "due_soon" | "due" | "overdue" | "unknown",
            "miles_remaining": int or None,
            "days_remaining": int or None,
            "miles_overdue": int or None,   # positive when past due
            "days_overdue": int or None,    # positive when past due
            "next_due_mileage": int or None,
            "next_due_date": "YYYY-MM-DD" or None,
            "percent_miles": float,   # 0-100+, progress through interval
            "percent_time": float,    # 0-100+, progress through interval
        }
    """
    if current_date is None:
        current_date = date.today()

    # -- If we have no service history at all, we can't compute anything -----
    if interval.last_service_date is None and interval.last_service_mileage is None:
        return {
            "status": "unknown",
            "miles_remaining": None,
            "days_remaining": None,
            "miles_overdue": None,
            "days_overdue": None,
            "next_due_mileage": None,
            "next_due_date": None,
            "percent_miles": 0,
            "percent_time": 0,
        }

    # -- Mileage calculations -----------------------------------------------
    # Only compute if we have BOTH a last service mileage AND a miles interval
    next_due_mileage = None
    miles_remaining = None
    miles_overdue = None
    percent_miles = 0

    if interval.last_service_mileage is not None and interval.miles_interval is not None:
        next_due_mileage = interval.last_service_mileage + interval.miles_interval
        miles_remaining = next_due_mileage - current_mileage  # negative = overdue
        miles_overdue = max(0, -miles_remaining)
        # How far through the interval (0% = just serviced, 100% = due now)
        if interval.miles_interval > 0:
            percent_miles = ((current_mileage - interval.last_service_mileage) / interval.miles_interval) * 100
        else:
            percent_miles = 0

    # -- Time calculations --------------------------------------------------
    # Only compute if we have BOTH a last service date AND a months interval
    next_due_date = None
    days_remaining = None
    days_overdue = None
    percent_time = 0

    if interval.last_service_date is not None and interval.months_interval:
        # Calculate the next due date using accurate month math if available
        if HAS_DATEUTIL:
            next_due_date = interval.last_service_date + relativedelta(months=interval.months_interval)
        else:
            # Approximate: 1 month ~ 30 days
            next_due_date = interval.last_service_date + timedelta(days=interval.months_interval * 30)

        days_remaining = (next_due_date - current_date).days  # negative = overdue
        days_overdue = max(0, -days_remaining)

        # How far through the time interval (0% = just serviced, 100% = due now)
        total_days_in_interval = interval.months_interval * 30  # approximate for percentage
        if total_days_in_interval > 0:
            elapsed_days = (current_date - interval.last_service_date).days
            percent_time = (elapsed_days / total_days_in_interval) * 100
        else:
            percent_time = 0

    # -- Determine overall status -------------------------------------------
    status = _determine_status(
        interval.condition_type,
        interval.miles_interval,
        interval.months_interval,
        miles_remaining,
        days_remaining,
    )

    return {
        "status": status,
        "miles_remaining": miles_remaining,
        "days_remaining": days_remaining,
        "miles_overdue": miles_overdue,
        "days_overdue": days_overdue,
        "next_due_mileage": next_due_mileage,
        "next_due_date": next_due_date.isoformat() if next_due_date else None,
        "percent_miles": round(percent_miles, 1),
        "percent_time": round(percent_time, 1),
    }


def _determine_status(condition_type, miles_interval, months_interval, miles_remaining, days_remaining):
    """
    Determine the overall status string based on condition_type logic.

    For 'or' (default, most conservative):
      - Any single threshold being overdue makes the whole item overdue.
      - This is the "whichever comes first" approach.

    For 'and':
      - BOTH thresholds must be overdue for the item to be considered overdue.
      - But if only one threshold type is configured (miles only, or months only),
        then only that one is checked.
      - "due_soon" still fires if either is approaching (we still want to warn).

    If neither miles_interval nor months_interval is set, return "unknown".

    Args:
        condition_type: 'or' or 'and'
        miles_interval: The configured miles interval (or None if not set)
        months_interval: The configured months interval (or None if not set)
        miles_remaining: Miles until due (negative = overdue), or None
        days_remaining: Days until due (negative = overdue), or None

    Returns:
        One of: "ok", "due_soon", "due", "overdue", "unknown"
    """
    # If neither interval type is configured, we can't determine status
    has_miles = miles_interval is not None and miles_interval > 0 and miles_remaining is not None
    has_time = months_interval is not None and months_interval > 0 and days_remaining is not None

    if not has_miles and not has_time:
        return "unknown"

    # Helper flags for each threshold type
    miles_overdue = has_miles and miles_remaining < 0
    miles_due = has_miles and miles_remaining == 0
    miles_due_soon = has_miles and 0 < miles_remaining <= 1000
    time_overdue = has_time and days_remaining < 0
    time_due = has_time and days_remaining == 0
    time_due_soon = has_time and 0 < days_remaining <= 30

    # -- OR logic: whichever comes first ------------------------------------
    if condition_type == 'or' or not has_miles or not has_time:
        # If only one threshold type exists, OR and AND behave the same —
        # we just check the one that exists. So we use OR logic here for
        # both the actual 'or' condition and the single-threshold case.
        if miles_overdue or time_overdue:
            return "overdue"
        if miles_due or time_due:
            return "due"
        if miles_due_soon or time_due_soon:
            return "due_soon"
        return "ok"

    # -- AND logic: both must be overdue ------------------------------------
    # (We only reach here if condition_type == 'and' AND both thresholds exist)
    if miles_overdue and time_overdue:
        return "overdue"
    if miles_due and time_due:
        return "due"
    # Still warn if either is approaching — the user should know
    if miles_due_soon or time_due_soon:
        return "due_soon"
    return "ok"


# ---------------------------------------------------------------------------
# 2. Direct dispatch for intervals with channel config
# ---------------------------------------------------------------------------

def _dispatch_interval_notification(interval, vehicle_name, status_info, milestone_type, threshold_value):
    """
    Send a notification directly to the interval's configured channels.

    Bypasses the generic event/rule system. Used when an interval has
    notification_channel_ids configured via the Notifications > Intervals tab.

    Args:
        interval: VehicleMaintenanceInterval with notification delivery config.
        vehicle_name: Human-readable vehicle name (e.g., "2021 RAM 1500").
        status_info: Dict from check_interval_status().
        milestone_type: 'miles', 'months', or 'due_soon'.
        threshold_value: The milestone threshold that was reached.
    """
    from app.models.notification import NotificationChannel, NotificationLog, NotificationSettings
    from app.services.channels import get_channel_handler
    from app.services.dispatcher import render_template
    from app.services.rule_evaluator import _is_quiet_hours

    # Check global kill switch
    settings = NotificationSettings.get_settings()
    if not settings.enabled:
        return

    # Check quiet hours
    if _is_quiet_hours(settings):
        return

    # Build the template data dict (same variables available as in event payloads)
    data = {
        'vehicle_name': vehicle_name,
        'vehicle_id': interval.vehicle_id,
        'item_name': interval.item.name if interval.item else 'Unknown',
        'item_category': interval.item.category if interval.item else 'Unknown',
        'status': status_info['status'],
        'miles_remaining': status_info.get('miles_remaining'),
        'days_remaining': status_info.get('days_remaining'),
        'miles_overdue': status_info.get('miles_overdue', 0),
        'days_overdue': status_info.get('days_overdue', 0),
        'next_due_mileage': status_info.get('next_due_mileage'),
        'next_due_date': status_info.get('next_due_date'),
        'milestone_type': milestone_type,
        'threshold_value': threshold_value,
    }

    # Use interval's templates, falling back to sensible defaults
    title_template = interval.notification_title_template or '{{item_name}} - {{status}}'
    body_template = interval.notification_body_template or (
        '{{item_name}} on {{vehicle_name}} is {{status}}. '
        'Miles: {{miles_overdue}} overdue. Days: {{days_overdue}} overdue.'
    )

    title = render_template(title_template, data)
    body = render_template(body_template, data)
    priority = interval.notification_priority or 'normal'

    # Send to each configured channel
    for channel_id in (interval.notification_channel_ids or []):
        channel = None
        start_time = time.time()
        try:
            channel = NotificationChannel.query.get(channel_id)
            if not channel or not channel.is_enabled:
                continue

            handler = get_channel_handler(channel.channel_type)
            handler.send(channel.config, title, body, priority)
            duration_ms = int((time.time() - start_time) * 1000)

            # Log successful delivery (rule_id=None for direct dispatch)
            log_entry = NotificationLog(
                rule_id=None,
                channel_id=channel.id,
                channel_type=channel.channel_type,
                title=title,
                body=body,
                priority=priority,
                status='sent',
                delivery_duration_ms=duration_ms,
                event_data=data,
                sent_at=datetime.now(timezone.utc),
            )
            db.session.add(log_entry)
            db.session.commit()

            logger.info(
                f"Interval notification sent: '{interval.item.name}' -> "
                f"channel '{channel.name}' ({duration_ms}ms)"
            )

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)

            log_entry = NotificationLog(
                rule_id=None,
                channel_id=channel_id,
                channel_type=channel.channel_type if channel else 'unknown',
                title=title,
                body=body,
                priority=priority,
                status='failed',
                error_message=str(e),
                delivery_duration_ms=duration_ms,
                event_data=data,
                sent_at=datetime.now(timezone.utc),
            )
            db.session.add(log_entry)
            db.session.commit()

            logger.error(
                f"Interval notification failed: '{interval.item.name}' -> "
                f"channel {channel_id}: {e}"
            )


# ---------------------------------------------------------------------------
# 3. Check & notify for a single vehicle
# ---------------------------------------------------------------------------

def check_and_notify_intervals(vehicle_id, source='immediate'):
    """
    Check all enabled intervals for a vehicle and emit notification events
    when overdue milestones are reached.

    Called after:
      - Fuel log creation (mileage updated)  → source='immediate'
      - Maintenance log creation (mileage updated) → source='immediate'
      - Daily 9 AM scheduler job → source='scheduled'

    Intervals with notification_timing='scheduled' will only dispatch
    notifications when source='scheduled' (the daily check). Milestones
    are still tracked regardless so nothing is missed.

    Args:
        vehicle_id: The ID of the vehicle to check.
        source: 'immediate' (from route handlers) or 'scheduled' (from daily job).
    """
    try:
        # Import emit inside function to avoid circular imports
        from app.services.event_bus import emit

        # Get the vehicle; bail out if not found or no mileage recorded
        vehicle = Vehicle.query.get(vehicle_id)
        if not vehicle or vehicle.current_mileage is None:
            return

        # Build a human-readable name for notifications
        vehicle_name = f"{vehicle.year} {vehicle.make} {vehicle.model}"

        # Get all enabled intervals for this vehicle
        intervals = VehicleMaintenanceInterval.query.filter_by(
            vehicle_id=vehicle_id,
            is_enabled=True,
        ).all()

        today = date.today()

        for interval in intervals:
            try:
                # Compute current status
                status_info = check_interval_status(interval, vehicle.current_mileage, today)

                # Skip intervals with unknown status (no service history)
                # or ok status (nothing due — no reason to notify)
                if status_info['status'] in ('unknown', 'ok'):
                    continue

                # Skip intervals set to scheduled-only during immediate checks.
                # The daily 9 AM job (source='scheduled') will process them.
                if getattr(interval, 'notification_timing', 'immediate') == 'scheduled' and source == 'immediate':
                    continue

                # Make a mutable copy of notified_milestones so SQLAlchemy detects changes.
                # JSON columns don't track in-place mutations automatically.
                notified = dict(interval.notified_milestones or {"miles": [], "months": []})
                if "miles" not in notified:
                    notified["miles"] = []
                if "months" not in notified:
                    notified["months"] = []

                milestones_changed = False

                # -- Check miles milestones ----------------------------------
                # Collect ALL newly-reached thresholds first, then only
                # dispatch ONE notification for the highest one. This prevents
                # spamming when a big mileage jump crosses multiple thresholds.
                if status_info['miles_overdue'] is not None:
                    new_miles_thresholds = []
                    for threshold in (interval.notify_miles_thresholds or []):
                        if threshold <= status_info['miles_overdue'] and threshold not in notified["miles"]:
                            new_miles_thresholds.append(threshold)
                            notified["miles"].append(threshold)
                            milestones_changed = True

                    # Only send notification for the highest newly-reached threshold
                    if new_miles_thresholds:
                        highest = max(new_miles_thresholds)
                        try:
                            if interval.notification_channel_ids is not None:
                                _dispatch_interval_notification(
                                    interval, vehicle_name, status_info, 'miles', highest)
                            else:
                                emit('maintenance.interval_due',
                                     vehicle_id=vehicle_id,
                                     vehicle_name=vehicle_name,
                                     item_name=interval.item.name,
                                     item_category=interval.item.category,
                                     status=status_info['status'],
                                     miles_remaining=status_info['miles_remaining'],
                                     days_remaining=status_info['days_remaining'],
                                     miles_overdue=status_info['miles_overdue'],
                                     days_overdue=status_info['days_overdue'],
                                     next_due_mileage=status_info['next_due_mileage'],
                                     next_due_date=status_info['next_due_date'])
                        except Exception:
                            pass  # Never let notification failures break the operation

                # -- Check months milestones ---------------------------------
                # Same batching logic for time-based overdue thresholds.
                # Thresholds are in months, so convert days_overdue to months.
                if status_info['days_overdue'] is not None:
                    months_overdue = status_info['days_overdue'] / 30  # approximate
                    new_months_thresholds = []
                    for threshold in (interval.notify_months_thresholds or []):
                        if threshold <= months_overdue and threshold not in notified["months"]:
                            new_months_thresholds.append(threshold)
                            notified["months"].append(threshold)
                            milestones_changed = True

                    # Only send notification for the highest newly-reached threshold
                    if new_months_thresholds:
                        highest = max(new_months_thresholds)
                        try:
                            if interval.notification_channel_ids is not None:
                                _dispatch_interval_notification(
                                    interval, vehicle_name, status_info, 'months', highest)
                            else:
                                emit('maintenance.interval_due',
                                     vehicle_id=vehicle_id,
                                     vehicle_name=vehicle_name,
                                     item_name=interval.item.name,
                                     item_category=interval.item.category,
                                     status=status_info['status'],
                                     miles_remaining=status_info['miles_remaining'],
                                     days_remaining=status_info['days_remaining'],
                                     miles_overdue=status_info['miles_overdue'],
                                     days_overdue=status_info['days_overdue'],
                                     next_due_mileage=status_info['next_due_mileage'],
                                     next_due_date=status_info['next_due_date'])
                        except Exception:
                            pass

                # -- Check due_soon (one-time early warning) -----------------
                # If the interval is approaching due and we haven't notified
                # any milestones yet, send a single "due soon" heads-up.
                if status_info['status'] == 'due_soon':
                    no_miles_notified = len(notified.get("miles", [])) == 0
                    no_months_notified = len(notified.get("months", [])) == 0
                    if no_miles_notified and no_months_notified:
                        try:
                            if interval.notification_channel_ids is not None:
                                _dispatch_interval_notification(
                                    interval, vehicle_name, status_info, 'due_soon', 0)
                            else:
                                emit('maintenance.interval_due_soon',
                                     vehicle_id=vehicle_id,
                                     vehicle_name=vehicle_name,
                                     item_name=interval.item.name,
                                     item_category=interval.item.category,
                                     status=status_info['status'],
                                     miles_remaining=status_info['miles_remaining'],
                                     days_remaining=status_info['days_remaining'],
                                     miles_overdue=status_info['miles_overdue'],
                                     days_overdue=status_info['days_overdue'],
                                     next_due_mileage=status_info['next_due_mileage'],
                                     next_due_date=status_info['next_due_date'])
                        except Exception:
                            pass

                # -- Save updated milestones if anything changed -------------
                if milestones_changed:
                    # Assign a new dict so SQLAlchemy detects the column change
                    interval.notified_milestones = notified

            except Exception as e:
                # Log but don't break — continue checking other intervals
                logger.error(
                    f"Error checking interval {interval.id} "
                    f"(item '{interval.item.name if interval.item else '?'}'): {e}"
                )

        # Commit any milestone updates
        db.session.commit()

    except Exception as e:
        # Top-level safety net: never break the calling operation
        logger.error(f"check_and_notify_intervals failed for vehicle {vehicle_id}: {e}")
        try:
            db.session.rollback()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# 4. Check all vehicles (daily scheduler job)
# ---------------------------------------------------------------------------

def check_all_vehicle_intervals():
    """
    Check intervals for ALL vehicles that have at least one enabled interval.

    Called by the daily scheduler job. Iterates through every vehicle and
    calls check_and_notify_intervals() for each one. Failures for one
    vehicle do not stop processing of others.
    """
    logger.info("Starting daily maintenance interval check for all vehicles")

    try:
        # Get IDs of all vehicles that have at least one enabled interval.
        # Using a subquery avoids loading full Vehicle objects just to get IDs.
        vehicle_ids = db.session.query(
            VehicleMaintenanceInterval.vehicle_id
        ).filter_by(
            is_enabled=True
        ).distinct().all()

        # vehicle_ids is a list of tuples like [(1,), (3,), (5,)]
        checked = 0
        errors = 0

        for (vid,) in vehicle_ids:
            try:
                check_and_notify_intervals(vid, source='scheduled')
                checked += 1
            except Exception as e:
                errors += 1
                logger.error(f"Daily interval check failed for vehicle {vid}: {e}")

        logger.info(
            f"Daily interval check complete: {checked} vehicles checked, "
            f"{errors} errors"
        )

    except Exception as e:
        logger.error(f"check_all_vehicle_intervals failed: {e}")
