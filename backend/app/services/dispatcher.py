"""
Notification Dispatcher

Handles the final step of sending notifications:
1. Renders title and body templates by replacing {{variable}} placeholders
2. Routes the notification to each assigned channel
3. Logs every delivery attempt to notification_log (success or failure)

Key design: One failed channel NEVER prevents delivery to other channels.
Each channel is handled independently with its own try/except.
"""
import re
import time
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def dispatch(rule, data):
    """
    Send a notification through all channels assigned to a rule.

    Args:
        rule: NotificationRule instance
        data: Dict of event payload data (used for template rendering)
    """
    from app import db
    from app.models.notification import NotificationLog, NotificationRuleChannel
    from app.services.channels import get_channel_handler

    # Render templates
    title = render_template(rule.title_template or '', data)
    body = render_template(rule.body_template, data)

    # Get all channel links for this rule
    channel_links = NotificationRuleChannel.query.filter_by(rule_id=rule.id).all()

    if not channel_links:
        logger.warning(f"Rule '{rule.name}' has no channels assigned")
        return

    for link in channel_links:
        channel = link.channel
        if not channel or not channel.is_enabled:
            continue

        # Merge channel config with per-rule overrides
        config = {**channel.config, **(link.channel_overrides or {})}

        # Time the delivery
        start_time = time.time()

        try:
            handler = get_channel_handler(channel.channel_type)
            handler.send(config, title, body, rule.priority)

            duration_ms = int((time.time() - start_time) * 1000)

            # Log successful delivery
            log_entry = NotificationLog(
                rule_id=rule.id,
                channel_id=channel.id,
                channel_type=channel.channel_type,
                title=title,
                body=body,
                priority=rule.priority,
                status='sent',
                delivery_duration_ms=duration_ms,
                event_data=data,
                sent_at=datetime.now(timezone.utc),
            )
            db.session.add(log_entry)
            db.session.commit()

            logger.info(f"Notification sent: rule='{rule.name}' channel='{channel.name}' ({duration_ms}ms)")

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)

            # Log failed delivery — but continue to next channel
            log_entry = NotificationLog(
                rule_id=rule.id,
                channel_id=channel.id,
                channel_type=channel.channel_type,
                title=title,
                body=body,
                priority=rule.priority,
                status='failed',
                error_message=str(e),
                delivery_duration_ms=duration_ms,
                event_data=data,
                sent_at=datetime.now(timezone.utc),
            )
            db.session.add(log_entry)
            db.session.commit()

            logger.error(f"Notification failed: rule='{rule.name}' channel='{channel.name}': {e}")


def render_template(template, data):
    """
    Replace {{variable}} placeholders with values from the data dict.

    Uses simple regex replacement — NOT Jinja2. This avoids template
    injection concerns and keeps things simple.

    Args:
        template: String with {{variable}} placeholders
        data: Dict of values to substitute

    Returns:
        Rendered string. Unknown variables are left as-is.

    Example:
        render_template("Hello {{name}}, your car has {{mileage}} miles",
                       {"name": "Chase", "mileage": 50000})
        → "Hello Chase, your car has 50000 miles"
    """
    if not template:
        return ''

    def replacer(match):
        key = match.group(1).strip()
        value = data.get(key)
        if value is not None:
            return str(value)
        return match.group(0)  # Leave {{unknown}} as-is

    return re.sub(r'\{\{(\s*\w+\s*)\}\}', replacer, template)
