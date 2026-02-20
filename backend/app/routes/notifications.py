"""
Notifications Module - API Routes

Full CRUD for notification channels, rules, in-app feed, log history,
and global settings. Ties into the channel handler system for multi-
channel delivery (Pushover, Discord, email, SMS, in-app).

Endpoints:
  Channels:
    GET    /api/notifications/channels/schemas          -> Config schemas for all channel types
    GET    /api/notifications/channels                  -> List all channels
    POST   /api/notifications/channels                  -> Create a channel
    GET    /api/notifications/channels/<id>             -> Get one channel
    PUT    /api/notifications/channels/<id>             -> Update a channel
    DELETE /api/notifications/channels/<id>             -> Delete a channel
    POST   /api/notifications/channels/<id>/test        -> Send a test notification

  Rules:
    GET    /api/notifications/rules/events              -> Available event names
    GET    /api/notifications/rules/template-variables/<module> -> Template vars for a module
    GET    /api/notifications/rules                     -> List all rules
    POST   /api/notifications/rules                     -> Create a rule
    GET    /api/notifications/rules/<id>                -> Get one rule
    PUT    /api/notifications/rules/<id>                -> Update a rule
    DELETE /api/notifications/rules/<id>                -> Delete a rule
    POST   /api/notifications/rules/<id>/trigger        -> Manually fire a rule

  Feed (in-app bell icon):
    GET    /api/notifications/feed                      -> Recent in-app notifications
    GET    /api/notifications/unread-count              -> Unread badge count
    PUT    /api/notifications/feed/<id>/read            -> Mark one as read
    PUT    /api/notifications/feed/read-all             -> Mark all as read

  History / Log:
    GET    /api/notifications/log                       -> Paginated notification log
    GET    /api/notifications/stats                     -> Aggregate stats

  Settings:
    GET    /api/notifications/settings                  -> Get global settings
    PUT    /api/notifications/settings                  -> Update global settings
"""
import math
from datetime import datetime, timedelta, timezone

from flask import Blueprint, request, jsonify
from app import db
from app.models.notification import (
    NotificationChannel,
    NotificationRule,
    NotificationRuleChannel,
    NotificationLog,
    NotificationSettings,
)
from app.services.channels import get_all_schemas, get_channel_handler

notifications_bp = Blueprint('notifications', __name__)


# ── Available Events ──────────────────────────────────────────────
# Hardcoded list of events that rules can subscribe to.
# Each entry describes what module it belongs to, what it does,
# and which data fields are available for use in templates.

AVAILABLE_EVENTS = [
    {
        'name': 'maintenance.created',
        'module': 'vehicles',
        'description': 'When a new maintenance record is added',
        'fields': ['vehicle_id', 'service_type', 'description', 'date', 'mileage', 'cost', 'shop_name'],
    },
    {
        'name': 'vehicle.created',
        'module': 'vehicles',
        'description': 'When a new vehicle is added',
        'fields': ['year', 'make', 'model', 'trim', 'color'],
    },
    {
        'name': 'fuel.created',
        'module': 'vehicles',
        'description': 'When a fuel log entry is added',
        'fields': ['vehicle_id', 'date', 'mileage', 'gallons', 'cost_per_gallon', 'total_cost', 'mpg', 'location'],
    },
    {
        'name': 'note.created',
        'module': 'notes',
        'description': 'When a new note is created',
        'fields': ['title', 'tags'],
    },
    {
        'name': 'note.trashed',
        'module': 'notes',
        'description': 'When a note is moved to trash',
        'fields': ['title'],
    },
    {
        'name': 'note.starred',
        'module': 'notes',
        'description': 'When a note is starred',
        'fields': ['title'],
    },
    {
        'name': 'tire_set.swapped',
        'module': 'vehicles',
        'description': 'When tire sets are swapped on a vehicle',
        'fields': ['vehicle_id', 'set_name'],
    },
    {
        'name': 'component.created',
        'module': 'vehicles',
        'description': 'When a vehicle component is added',
        'fields': ['vehicle_id', 'component_type', 'brand', 'model', 'position'],
    },
    {
        'name': 'maintenance.interval_due',
        'module': 'vehicles',
        'description': 'When a maintenance interval milestone is reached (due or overdue)',
        'fields': ['vehicle_id', 'vehicle_name', 'item_name', 'item_category', 'status',
                   'miles_remaining', 'days_remaining', 'miles_overdue', 'days_overdue',
                   'next_due_mileage', 'next_due_date'],
    },
    {
        'name': 'maintenance.interval_due_soon',
        'module': 'vehicles',
        'description': 'When a maintenance interval is approaching (within 500 miles or 30 days)',
        'fields': ['vehicle_id', 'vehicle_name', 'item_name', 'item_category', 'status',
                   'miles_remaining', 'days_remaining', 'miles_overdue', 'days_overdue',
                   'next_due_mileage', 'next_due_date'],
    },
    # ── Astrometrics Events ───────────────────────────────────
    {
        'name': 'astro.launch_reminder',
        'module': 'astrometrics',
        'description': 'When a rocket launch is approaching within the configured reminder window',
        'fields': ['launch_name', 'provider', 'net', 'hours_until', 'pad_name'],
    },
    {
        'name': 'astro.neo_close_approach',
        'module': 'astrometrics',
        'description': 'When a Near Earth Object passes closer than the configured threshold',
        'fields': ['name', 'date', 'miss_distance_ld', 'miss_distance_km', 'is_hazardous'],
    },
    {
        'name': 'astro.neo_hazardous',
        'module': 'astrometrics',
        'description': 'When a potentially hazardous asteroid is detected this week',
        'fields': ['name', 'date', 'miss_distance_ld', 'velocity_kps'],
    },
    {
        'name': 'astro.launch_inflight',
        'module': 'astrometrics',
        'description': 'When a tracked launch transitions to In Flight status',
        'fields': ['launch_name', 'provider', 'net', 'pad_name'],
    },
    {
        'name': 'astro.apod_new',
        'module': 'astrometrics',
        'description': 'When a new Astronomy Picture of the Day is available',
        'fields': ['title', 'date', 'media_type'],
    },
]


# ═══════════════════════════════════════════════════════════════════
# Channel Endpoints
# ═══════════════════════════════════════════════════════════════════

# IMPORTANT: /channels/schemas is defined BEFORE /channels/<int:channel_id>
# so Flask doesn't try to parse "schemas" as an integer parameter.

@notifications_bp.route('/channels/schemas', methods=['GET'])
def list_channel_schemas():
    """
    Get CONFIG_SCHEMA for all registered channel types.

    The frontend uses this to dynamically render settings forms
    (e.g., which fields to show when creating a Pushover vs Discord channel).

    Returns:
        dict keyed by channel_type, each containing display_name,
        channel_type, and schema (list of field definitions).
    """
    return jsonify(get_all_schemas())


@notifications_bp.route('/channels', methods=['GET'])
def list_channels():
    """
    List all notification channels, newest first.

    Returns a list of all configured channels (Pushover, Discord,
    in-app, etc.) regardless of enabled/disabled status.
    """
    channels = NotificationChannel.query.order_by(NotificationChannel.created_at.desc()).all()
    return jsonify([c.to_dict() for c in channels])


@notifications_bp.route('/channels', methods=['POST'])
def create_channel():
    """
    Create a new notification channel.

    Expects JSON like:
    {
        "name": "My Phone",
        "channel_type": "pushover",
        "config": {"user_key": "abc123", "api_token": "xyz789"},
        "is_enabled": true
    }

    The config object is validated against the channel handler's
    CONFIG_SCHEMA to make sure all required fields are present.
    """
    data = request.get_json()

    # Validate required fields
    if not all(k in data for k in ('name', 'channel_type')):
        return jsonify({'error': 'name and channel_type are required'}), 400

    # Validate config against the channel handler's schema
    config = data.get('config', {})
    try:
        handler = get_channel_handler(data['channel_type'])
        errors = handler.validate_config(config)
        if errors:
            return jsonify({'error': ', '.join(errors)}), 400
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    channel = NotificationChannel(
        name=data['name'],
        channel_type=data['channel_type'],
        config=config,
        is_enabled=data.get('is_enabled', True),
    )
    db.session.add(channel)
    db.session.commit()

    return jsonify(channel.to_dict()), 201


@notifications_bp.route('/channels/<int:channel_id>', methods=['GET'])
def get_channel(channel_id):
    """Get a single notification channel."""
    channel = NotificationChannel.query.get_or_404(channel_id)
    return jsonify(channel.to_dict())


@notifications_bp.route('/channels/<int:channel_id>', methods=['PUT'])
def update_channel(channel_id):
    """Update a notification channel."""
    channel = NotificationChannel.query.get_or_404(channel_id)
    data = request.get_json()

    for field in ('name', 'channel_type', 'config', 'is_enabled'):
        if field in data:
            setattr(channel, field, data[field])

    db.session.commit()
    return jsonify(channel.to_dict())


@notifications_bp.route('/channels/<int:channel_id>', methods=['DELETE'])
def delete_channel(channel_id):
    """Delete a notification channel."""
    channel = NotificationChannel.query.get_or_404(channel_id)
    db.session.delete(channel)
    db.session.commit()
    return jsonify({'message': 'Channel deleted'}), 200


@notifications_bp.route('/channels/<int:channel_id>/test', methods=['POST'])
def test_channel(channel_id):
    """
    Send a test notification through a channel.

    Sends a simple "Test notification from Datacore" message using
    the channel's configured handler and settings.

    Returns:
        200 with success message, or 500 with error details.
    """
    channel = NotificationChannel.query.get_or_404(channel_id)

    try:
        handler = get_channel_handler(channel.channel_type)
        handler.send(
            config=channel.config,
            title='Datacore Test',
            body='Test notification from Datacore. If you see this, your channel is working!',
            priority='normal',
        )
        return jsonify({'message': 'Test notification sent successfully'})
    except Exception as e:
        return jsonify({'error': f'Test failed: {str(e)}'}), 500


# ═══════════════════════════════════════════════════════════════════
# Rule Endpoints
# ═══════════════════════════════════════════════════════════════════

# IMPORTANT: /rules/events and /rules/template-variables/<module> are
# defined BEFORE /rules/<int:rule_id> so Flask doesn't try to parse
# "events" or "template-variables" as integer parameters.

@notifications_bp.route('/rules/events', methods=['GET'])
def list_available_events():
    """
    List all available event names that rules can subscribe to.

    Each event includes:
      - name: the event identifier (e.g., 'maintenance.created')
      - module: which module emits this event
      - description: human-readable explanation
      - fields: data fields available for use in message templates
    """
    return jsonify(AVAILABLE_EVENTS)


@notifications_bp.route('/rules/template-variables/<module>', methods=['GET'])
def list_template_variables(module):
    """
    Get available template variables for a specific module.

    Filters AVAILABLE_EVENTS by the given module and collects
    all unique field names. These are the {{variable}} placeholders
    you can use in rule body/title templates.

    Args:
        module: Module name like 'vehicles' or 'notes'.

    Returns:
        List of unique field name strings.
    """
    # Collect all fields from events belonging to this module
    fields = set()
    for event in AVAILABLE_EVENTS:
        if event['module'] == module:
            fields.update(event['fields'])

    return jsonify(sorted(fields))


@notifications_bp.route('/rules', methods=['GET'])
def list_rules():
    """
    List all notification rules, newest first.

    Each rule includes its linked channel_ids via to_dict().
    """
    rules = NotificationRule.query.order_by(NotificationRule.created_at.desc()).all()
    return jsonify([r.to_dict() for r in rules])


@notifications_bp.route('/rules', methods=['POST'])
def create_rule():
    """
    Create a new notification rule.

    Expects JSON like:
    {
        "name": "Oil Change Reminder",
        "body_template": "Time for an oil change on {{vehicle_name}}!",
        "rule_type": "scheduled",
        "module": "vehicles",
        "title_template": "Maintenance Due",
        "priority": "high",
        "schedule_config": {"type": "cron", "cron": "0 9 * * MON"},
        "channel_ids": [1, 3]
    }

    When channel_ids is provided, NotificationRuleChannel entries are
    created to link the rule to those channels. If the rule_type is
    'scheduled', the scheduler is synced after creation.
    """
    data = request.get_json()

    # Validate required fields
    if not all(k in data for k in ('name', 'body_template', 'rule_type')):
        return jsonify({'error': 'name, body_template, and rule_type are required'}), 400

    rule = NotificationRule(
        name=data['name'],
        description=data.get('description'),
        module=data.get('module'),
        rule_type=data['rule_type'],
        schedule_config=data.get('schedule_config'),
        event_name=data.get('event_name'),
        conditions=data.get('conditions', []),
        title_template=data.get('title_template'),
        body_template=data['body_template'],
        priority=data.get('priority', 'normal'),
        cooldown_minutes=data.get('cooldown_minutes', 0),
        is_enabled=data.get('is_enabled', True),
    )
    db.session.add(rule)
    db.session.flush()  # Get rule.id before creating channel links

    # Create rule-channel links if channel_ids provided
    channel_ids = data.get('channel_ids', [])
    for cid in channel_ids:
        link = NotificationRuleChannel(rule_id=rule.id, channel_id=cid)
        db.session.add(link)

    db.session.commit()

    # If this is a scheduled rule, sync with the scheduler
    if rule.rule_type == 'scheduled':
        try:
            from app.services.scheduler import sync_scheduled_rules
            sync_scheduled_rules()
        except ImportError:
            pass  # Scheduler service not yet implemented

    return jsonify(rule.to_dict()), 201


@notifications_bp.route('/rules/<int:rule_id>', methods=['GET'])
def get_rule(rule_id):
    """Get a single notification rule with its channel details."""
    rule = NotificationRule.query.get_or_404(rule_id)
    return jsonify(rule.to_dict())


@notifications_bp.route('/rules/<int:rule_id>', methods=['PUT'])
def update_rule(rule_id):
    """
    Update a notification rule.

    When channel_ids is included in the update, the existing
    rule-channel links are deleted and recreated with the new set.
    If the rule_type is 'scheduled' or schedule_config changed,
    the scheduler is re-synced.
    """
    rule = NotificationRule.query.get_or_404(rule_id)
    data = request.get_json()

    # Track whether we need to re-sync the scheduler
    needs_scheduler_sync = False

    # Update simple fields
    for field in ('name', 'description', 'module', 'rule_type', 'schedule_config',
                  'event_name', 'conditions', 'title_template', 'body_template',
                  'priority', 'cooldown_minutes', 'is_enabled'):
        if field in data:
            setattr(rule, field, data[field])

    # Check if scheduler sync is needed
    if rule.rule_type == 'scheduled' or 'schedule_config' in data:
        needs_scheduler_sync = True

    # Update channel links if channel_ids provided
    if 'channel_ids' in data:
        # Delete existing links
        NotificationRuleChannel.query.filter_by(rule_id=rule.id).delete()
        # Create new links
        for cid in data['channel_ids']:
            link = NotificationRuleChannel(rule_id=rule.id, channel_id=cid)
            db.session.add(link)

    db.session.commit()

    # Re-sync scheduler if needed
    if needs_scheduler_sync:
        try:
            from app.services.scheduler import sync_scheduled_rules
            sync_scheduled_rules()
        except ImportError:
            pass  # Scheduler service not yet implemented

    return jsonify(rule.to_dict())


@notifications_bp.route('/rules/<int:rule_id>', methods=['DELETE'])
def delete_rule(rule_id):
    """
    Delete a notification rule.

    If the rule was a scheduled rule, the scheduler is re-synced
    after deletion to remove its scheduled job.
    """
    rule = NotificationRule.query.get_or_404(rule_id)
    was_scheduled = rule.rule_type == 'scheduled'

    db.session.delete(rule)
    db.session.commit()

    # Re-sync scheduler if this was a scheduled rule
    if was_scheduled:
        try:
            from app.services.scheduler import sync_scheduled_rules
            sync_scheduled_rules()
        except ImportError:
            pass  # Scheduler service not yet implemented

    return jsonify({'message': 'Rule deleted'}), 200


@notifications_bp.route('/rules/<int:rule_id>/trigger', methods=['POST'])
def trigger_rule(rule_id):
    """
    Manually fire a notification rule.

    Loads the rule, dispatches it with a manual trigger context,
    and updates the rule's last_fired_at timestamp.

    Returns:
        200 with success message, or 500 with error details.
    """
    rule = NotificationRule.query.get_or_404(rule_id)

    try:
        from app.services.dispatcher import dispatch
        now = datetime.now(timezone.utc)
        dispatch(rule, {'trigger': 'manual', 'fired_at': now.isoformat()})

        # Update last_fired_at on the rule
        rule.last_fired_at = now
        db.session.commit()

        return jsonify({'message': f'Rule "{rule.name}" triggered successfully'})
    except ImportError:
        return jsonify({'error': 'Dispatcher service not yet implemented'}), 500
    except Exception as e:
        return jsonify({'error': f'Trigger failed: {str(e)}'}), 500


# ═══════════════════════════════════════════════════════════════════
# Feed Endpoints (in-app bell icon)
# ═══════════════════════════════════════════════════════════════════

# IMPORTANT: /feed/read-all is defined BEFORE /feed/<int:log_id>/read
# so Flask doesn't try to parse "read-all" as an integer parameter.

@notifications_bp.route('/feed', methods=['GET'])
def list_feed():
    """
    Get recent in-app notifications for the bell icon dropdown.

    Query parameters:
        ?limit=20           -> Max items to return (default 20)
        ?unread_only=true   -> Only show unread notifications
    """
    limit = request.args.get('limit', 20, type=int)
    query = NotificationLog.query.filter_by(channel_type='in_app')

    # Optionally filter to unread only
    if request.args.get('unread_only') == 'true':
        query = query.filter_by(is_read=False)

    items = query.order_by(NotificationLog.sent_at.desc()).limit(limit).all()
    return jsonify([item.to_dict() for item in items])


@notifications_bp.route('/unread-count', methods=['GET'])
def unread_count():
    """
    Get the count of unread in-app notifications for the badge.

    Returns:
        {"count": N} where N is the number of unread in-app notifications.
    """
    count = NotificationLog.query.filter_by(
        channel_type='in_app',
        is_read=False,
    ).count()
    return jsonify({'count': count})


@notifications_bp.route('/feed/read-all', methods=['PUT'])
def mark_all_read():
    """
    Mark all unread in-app notifications as read.

    Updates every in-app notification where is_read is False,
    setting is_read to True and read_at to the current time.
    """
    now = datetime.now(timezone.utc)
    NotificationLog.query.filter_by(
        channel_type='in_app',
        is_read=False,
    ).update({
        'is_read': True,
        'read_at': now,
    }, synchronize_session=False)

    db.session.commit()
    return jsonify({'message': 'All notifications marked as read'})


@notifications_bp.route('/feed/<int:log_id>/read', methods=['PUT'])
def mark_read(log_id):
    """
    Mark a single in-app notification as read.

    Sets is_read to True and records the current timestamp in read_at.
    """
    log_entry = NotificationLog.query.get_or_404(log_id)
    log_entry.is_read = True
    log_entry.read_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(log_entry.to_dict())


# ═══════════════════════════════════════════════════════════════════
# History / Log Endpoints
# ═══════════════════════════════════════════════════════════════════

@notifications_bp.route('/log', methods=['GET'])
def list_log():
    """
    Get paginated notification history.

    Query parameters:
        ?page=1          -> Page number (default 1)
        ?per_page=25     -> Items per page (default 25)
        ?status=sent     -> Filter by delivery status
        ?channel_type=   -> Filter by channel type
        ?priority=high   -> Filter by priority level
        ?rule_id=5       -> Filter by rule ID
    """
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 25, type=int)

    query = NotificationLog.query

    # Apply optional filters
    status = request.args.get('status')
    if status:
        query = query.filter_by(status=status)

    channel_type = request.args.get('channel_type')
    if channel_type:
        query = query.filter_by(channel_type=channel_type)

    priority = request.args.get('priority')
    if priority:
        query = query.filter_by(priority=priority)

    rule_id = request.args.get('rule_id', type=int)
    if rule_id:
        query = query.filter_by(rule_id=rule_id)

    # Order newest first
    query = query.order_by(NotificationLog.sent_at.desc())

    # Get total count before pagination
    total = query.count()

    # Apply pagination
    items = query.offset((page - 1) * per_page).limit(per_page).all()

    return jsonify({
        'items': [item.to_dict() for item in items],
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': math.ceil(total / per_page) if per_page > 0 else 0,
    })


@notifications_bp.route('/stats', methods=['GET'])
def get_stats():
    """
    Get aggregate notification stats for the dashboard.

    Returns:
        - total_sent_24h: notifications sent in the last 24 hours
        - failed_24h: failed notifications in the last 24 hours
        - success_rate: percentage of successful deliveries
        - by_channel: count of notifications per channel type
        - most_active_rule: rule with the most log entries (id and name)
    """
    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=24)

    # Total sent in last 24 hours
    total_24h = NotificationLog.query.filter(
        NotificationLog.sent_at >= since
    ).count()

    # Failed in last 24 hours
    failed_24h = NotificationLog.query.filter(
        NotificationLog.sent_at >= since,
        NotificationLog.status == 'failed',
    ).count()

    # Success rate (avoid division by zero)
    if total_24h > 0:
        success_rate = round(((total_24h - failed_24h) / total_24h) * 100, 1)
    else:
        success_rate = 100.0

    # By-channel breakdown (count per channel_type)
    channel_counts = (
        db.session.query(
            NotificationLog.channel_type,
            db.func.count(NotificationLog.id),
        )
        .group_by(NotificationLog.channel_type)
        .all()
    )
    by_channel = {ct: count for ct, count in channel_counts}

    # Most active rule (highest log count overall)
    most_active = (
        db.session.query(
            NotificationLog.rule_id,
            db.func.count(NotificationLog.id).label('count'),
        )
        .filter(NotificationLog.rule_id.isnot(None))
        .group_by(NotificationLog.rule_id)
        .order_by(db.func.count(NotificationLog.id).desc())
        .first()
    )

    most_active_rule = None
    if most_active:
        rule = NotificationRule.query.get(most_active.rule_id)
        if rule:
            most_active_rule = {
                'rule_id': rule.id,
                'name': rule.name,
                'count': most_active.count,
            }

    return jsonify({
        'total_sent_24h': total_24h,
        'failed_24h': failed_24h,
        'success_rate': success_rate,
        'by_channel': by_channel,
        'most_active_rule': most_active_rule,
    })


# ═══════════════════════════════════════════════════════════════════
# Settings Endpoints
# ═══════════════════════════════════════════════════════════════════

@notifications_bp.route('/settings', methods=['GET'])
def get_settings():
    """
    Get global notification settings.

    Uses the singleton pattern -- always returns the single settings row,
    creating it with defaults if it doesn't exist yet.
    """
    settings = NotificationSettings.get_settings()
    return jsonify(settings.to_dict())


@notifications_bp.route('/settings', methods=['PUT'])
def update_settings():
    """
    Update global notification settings.

    Expects JSON with any combination of settings fields:
    {
        "enabled": true,
        "default_priority": "normal",
        "default_channel_ids": [1, 3],
        "quiet_hours_start": "22:00",
        "quiet_hours_end": "07:00",
        "quiet_hours_timezone": "America/Chicago",
        "retention_days": 90
    }

    Uses the upsert pattern: always updates row 1.
    """
    settings = NotificationSettings.get_settings()
    data = request.get_json()

    for field in ('enabled', 'default_priority', 'default_channel_ids',
                  'quiet_hours_start', 'quiet_hours_end', 'quiet_hours_timezone',
                  'retention_days'):
        if field in data:
            setattr(settings, field, data[field])

    db.session.commit()
    return jsonify(settings.to_dict())
