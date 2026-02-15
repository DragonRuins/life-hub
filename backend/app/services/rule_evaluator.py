"""
Notification Rule Evaluator

When an event is emitted, this module:
1. Finds all enabled rules that match the event name
2. Checks cooldown (has the rule fired too recently?)
3. Evaluates conditions against the event data
4. Checks quiet hours
5. Dispatches notifications through matched channels

Conditions are stored as a JSON array on the rule, for example:
    [
        {"field": "cost", "operator": ">", "value": 100},
        {"field": "service_type", "operator": "==", "value": "Oil Change"}
    ]

All conditions must pass (AND logic). Empty conditions = always matches.

Supported operators: ==, !=, >, >=, <, <=, contains, not_contains
"""
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def evaluate_event(event_name, data):
    """
    Find rules matching this event and dispatch if conditions pass.

    Args:
        event_name: The event identifier (e.g., 'maintenance.created')
        data: Dict of event payload data
    """
    from app import db
    from app.models.notification import NotificationRule, NotificationSettings

    # Check global kill switch
    settings = NotificationSettings.get_settings()
    if not settings.enabled:
        return

    # Find all enabled rules that listen for this event
    rules = NotificationRule.query.filter_by(
        is_enabled=True,
        event_name=event_name,
    ).filter(
        NotificationRule.rule_type.in_(['event', 'condition'])
    ).all()

    for rule in rules:
        try:
            # Check cooldown
            if not _check_cooldown(rule):
                logger.debug(f"Rule '{rule.name}' skipped (cooldown)")
                continue

            # Evaluate conditions
            if not evaluate_conditions(rule.conditions, data):
                logger.debug(f"Rule '{rule.name}' skipped (conditions not met)")
                continue

            # Check quiet hours
            if _is_quiet_hours(settings):
                logger.debug(f"Rule '{rule.name}' skipped (quiet hours)")
                continue

            # All checks passed — dispatch the notification
            from app.services.dispatcher import dispatch
            dispatch(rule, data)

            # Update cooldown timestamp
            rule.last_fired_at = datetime.now(timezone.utc)
            db.session.commit()

        except Exception as e:
            logger.error(f"Error evaluating rule '{rule.name}': {e}")
            db.session.rollback()


def evaluate_conditions(conditions, data):
    """
    Check if ALL conditions pass against the data payload.

    Args:
        conditions: List of condition dicts from the rule's conditions JSON
        data: Event payload dict

    Returns:
        True if all conditions pass (or if conditions is empty)
    """
    if not conditions:
        return True

    for condition in conditions:
        if not _evaluate_single_condition(condition, data):
            return False

    return True


def _evaluate_single_condition(condition, data):
    """
    Evaluate one condition against the data.

    A condition looks like:
        {"field": "cost", "operator": ">", "value": 100}

    With relative_to (compare two fields):
        {"field": "mileage", "operator": ">=", "relative_to": "next_service_mileage"}
    """
    field = condition.get('field')
    operator = condition.get('operator')

    # Get the field value from the event data
    field_value = data.get(field)
    if field_value is None:
        return False

    # Get the comparison value — either a literal or another field
    if 'relative_to' in condition and condition['relative_to']:
        compare_value = data.get(condition['relative_to'])
        if compare_value is None:
            return False
    else:
        compare_value = condition.get('value')

    # Try to compare as numbers if possible
    try:
        field_value = float(field_value)
        compare_value = float(compare_value)
    except (TypeError, ValueError):
        # Keep as original types (strings, etc.)
        pass

    # Evaluate the operator
    operators = {
        '==': lambda a, b: a == b,
        '!=': lambda a, b: a != b,
        '>': lambda a, b: a > b,
        '>=': lambda a, b: a >= b,
        '<': lambda a, b: a < b,
        '<=': lambda a, b: a <= b,
        'contains': lambda a, b: str(b).lower() in str(a).lower(),
        'not_contains': lambda a, b: str(b).lower() not in str(a).lower(),
    }

    op_func = operators.get(operator)
    if not op_func:
        logger.warning(f"Unknown operator: {operator}")
        return False

    try:
        return op_func(field_value, compare_value)
    except (TypeError, ValueError) as e:
        logger.warning(f"Condition evaluation error: {e}")
        return False


def _check_cooldown(rule):
    """
    Check if enough time has passed since the rule last fired.

    Returns True if the rule can fire (no cooldown or cooldown expired).
    """
    if not rule.cooldown_minutes or rule.cooldown_minutes <= 0:
        return True

    if not rule.last_fired_at:
        return True

    elapsed = (datetime.now(timezone.utc) - rule.last_fired_at).total_seconds()
    return elapsed >= (rule.cooldown_minutes * 60)


def _is_quiet_hours(settings):
    """
    Check if we're currently in quiet hours.

    Quiet hours are defined by start/end times in the user's timezone.
    During quiet hours, non-critical notifications are suppressed.

    Returns True if we're in quiet hours (should suppress).
    """
    if not settings.quiet_hours_start or not settings.quiet_hours_end:
        return False

    try:
        from zoneinfo import ZoneInfo
        tz = ZoneInfo(settings.quiet_hours_timezone or 'America/Chicago')
        now = datetime.now(tz)
        current_time = now.strftime('%H:%M')

        start = settings.quiet_hours_start
        end = settings.quiet_hours_end

        # Handle overnight ranges (e.g., 22:00 to 07:00)
        if start <= end:
            return start <= current_time <= end
        else:
            return current_time >= start or current_time <= end
    except Exception as e:
        logger.error(f"Quiet hours check failed: {e}")
        return False
