"""
Notification Event Bus

Provides a simple emit() function that other modules call when something
happens that might trigger a notification. For example, when a maintenance
log is created, the vehicles route calls:

    emit('maintenance.created', vehicle_id=1, service_type='Oil Change', ...)

The emit function directly calls the rule evaluator, which checks if any
enabled rules match this event and dispatches notifications accordingly.

This is synchronous (happens in the same request) — fine for a single-user app.
A future improvement could make this async with a task queue.
"""
import logging

logger = logging.getLogger(__name__)


def emit(event_name, **payload):
    """
    Emit a notification event.

    Call this from any module when something notification-worthy happens.
    The rule evaluator will check if any enabled rules match this event
    and dispatch notifications if conditions are met.

    Args:
        event_name: Dot-separated event name (e.g., 'maintenance.created')
        **payload: Key-value pairs that become the event data.
                   These are available as {{variable}} in templates.

    Example:
        emit('maintenance.created',
             vehicle_id=1,
             vehicle_name='2020 Toyota Tacoma',
             service_type='Oil Change',
             cost=45.99)
    """
    try:
        from app.services.rule_evaluator import evaluate_event
        evaluate_event(event_name, payload)
    except Exception as e:
        # Never let notification failures break the original operation
        logger.error(f"Notification event '{event_name}' failed: {e}")
