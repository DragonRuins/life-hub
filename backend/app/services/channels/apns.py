"""
Apple Push Notification service (APNs) — built-in push delivery.

Unlike other channels (Pushover, Discord) which are user-configured,
APNs is built-in infrastructure. Credentials come from environment
variables, and push delivery fires automatically for every notification
when device tokens are registered.

Uses aioapns (async HTTP/2 client) for Python 3.10+ compatibility.
Auth: Token-based (.p8 key file) — see https://developer.apple.com/documentation/usernotifications

Required environment variables:
    APNS_KEY_FILE   — Absolute path to the .p8 key file (e.g., /app/certs/AuthKey_XXXXXXXXXX.p8)
    APNS_KEY_ID     — 10-character Key ID from Apple Developer portal
    APNS_TEAM_ID    — 10-character Apple Developer Team ID
    APNS_BUNDLE_ID  — App bundle identifier (default: com.chaseburrell.Datacore)
    APNS_USE_SANDBOX — "true" for development, "false" for production (default: true)
"""
import asyncio
import logging
import os

from flask import current_app

logger = logging.getLogger(__name__)


def is_configured():
    """Check whether APNs environment variables are set."""
    key_file = current_app.config.get('APNS_KEY_FILE', '')
    key_id = current_app.config.get('APNS_KEY_ID', '')
    team_id = current_app.config.get('APNS_TEAM_ID', '')
    return bool(key_file and key_id and team_id)


def send_push(title, body, priority, **kwargs):
    """
    Send a push notification to ALL registered Apple devices.

    Called automatically by the dispatcher after channel delivery.
    Device tokens are loaded from the device_tokens table — this
    fans out to every registered device.

    Args:
        title (str): Notification title.
        body (str): Notification body.
        priority (str): One of 'low', 'normal', 'high', 'critical'.

    Extra kwargs supported:
        category (str): Notification category for actionable buttons.
        thread_id (str): Group notifications together (e.g., 'vehicle-42').
        deep_link (str): URL to open when notification is tapped.
        image_url (str): URL of image attachment for rich notifications.
        interruption_level (str): 'passive', 'active', 'time-sensitive', 'critical'.
    """
    # Run the async send in a new event loop (called from sync Flask context)
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If there's already a running loop (e.g., inside an async context),
            # create a new thread to run our coroutine
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, _send_push_async(title, body, priority, **kwargs))
                future.result()  # Block until done, propagate exceptions
        else:
            loop.run_until_complete(_send_push_async(title, body, priority, **kwargs))
    except RuntimeError:
        # No event loop exists — create one
        asyncio.run(_send_push_async(title, body, priority, **kwargs))


async def _send_push_async(title, body, priority, **kwargs):
    """
    Async implementation of push notification delivery using aioapns.
    """
    from aioapns import APNs, NotificationRequest, PushType
    from app.models.device_token import DeviceToken

    # Load credentials from environment (via Flask config)
    config = current_app.config
    key_file = config['APNS_KEY_FILE']
    key_id = config['APNS_KEY_ID']
    team_id = config['APNS_TEAM_ID']
    bundle_id = config.get('APNS_BUNDLE_ID', 'com.chaseburrell.Datacore')
    use_sandbox = config.get('APNS_USE_SANDBOX', True)

    if not os.path.exists(key_file):
        raise Exception(f"APNs key file not found: {key_file}")

    # Read the .p8 key file
    with open(key_file) as f:
        key_data = f.read()

    # Create the aioapns client
    client = APNs(
        key=key_data,
        key_id=key_id,
        team_id=team_id,
        topic=bundle_id,
        use_sandbox=use_sandbox,
    )

    # Map Datacore priority to iOS interruption level
    interruption_level = kwargs.get('interruption_level')
    if not interruption_level:
        interruption_map = {
            'low': 'passive',
            'normal': 'active',
            'high': 'time-sensitive',
            'critical': 'critical',
        }
        interruption_level = interruption_map.get(priority, 'active')

    # Build APNs payload (raw dict format for aioapns)
    aps_payload = {
        'alert': {'title': title or 'Datacore', 'body': body},
        'sound': 'default',
        'interruption-level': interruption_level,
    }

    if kwargs.get('category'):
        aps_payload['category'] = kwargs['category']
    if kwargs.get('thread_id'):
        aps_payload['thread-id'] = kwargs['thread_id']
    if kwargs.get('image_url'):
        aps_payload['mutable-content'] = 1

    message = {'aps': aps_payload}

    # Add custom data outside 'aps' key
    if kwargs.get('deep_link'):
        message['link'] = kwargs['deep_link']
    if kwargs.get('image_url'):
        message['image_url'] = kwargs['image_url']

    # Send to all registered devices
    tokens = DeviceToken.query.all()

    if not tokens:
        logger.info("APNs: No device tokens registered — skipping push")
        return

    failed_count = 0
    for device in tokens:
        try:
            request = NotificationRequest(
                device_token=device.token,
                message=message,
                push_type=PushType.ALERT,
            )

            response = await client.send_notification(request)

            if not response.is_successful:
                logger.error(
                    f"APNs delivery failed for {device.platform} "
                    f"({device.device_id[:8]}): {response.description}"
                )
                # If token is invalid, clean it up
                if response.description in ('BadDeviceToken', 'Unregistered'):
                    from app import db
                    db.session.delete(device)
                    db.session.commit()
                    logger.info(f"Removed stale device token: {device.device_id[:8]}")
                failed_count += 1
        except Exception as e:
            logger.error(f"APNs error for {device.device_id[:8]}: {e}")
            failed_count += 1

    await client.close()

    if failed_count == len(tokens):
        raise Exception(f"APNs: All {failed_count} device deliveries failed")

    logger.info(f"APNs: Sent to {len(tokens) - failed_count}/{len(tokens)} devices")
