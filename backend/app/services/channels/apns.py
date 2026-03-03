"""
Apple Push Notification service (APNs) channel handler.

Sends native push notifications to all registered Apple devices
(iPhone, iPad, Mac, Watch) using the APNs HTTP/2 API.

Auth: Token-based (.p8 key file) — see https://developer.apple.com/documentation/usernotifications

Unlike other channels (Pushover, Discord) which send to one destination,
this handler fans out to ALL registered device tokens. Each device gets
its own APNs request.
"""
import os
import logging

from . import BaseChannel, register_channel

logger = logging.getLogger(__name__)


@register_channel
class APNsChannel(BaseChannel):
    """Handler for Apple Push Notification service."""

    CHANNEL_TYPE = 'apns'
    DISPLAY_NAME = 'Apple Push Notifications'

    CONFIG_SCHEMA = [
        {
            'key': 'key_file',
            'label': 'APNs Key File Path',
            'type': 'text',
            'required': True,
            'help': 'Absolute path to the .p8 key file on the server (e.g., /app/certs/AuthKey_XXXXXXXXXX.p8)',
        },
        {
            'key': 'key_id',
            'label': 'Key ID',
            'type': 'text',
            'required': True,
            'help': 'The 10-character Key ID from Apple Developer portal (shown next to the key)',
        },
        {
            'key': 'team_id',
            'label': 'Team ID',
            'type': 'text',
            'required': True,
            'help': 'Your Apple Developer Team ID (10 characters)',
        },
        {
            'key': 'bundle_id',
            'label': 'Bundle ID',
            'type': 'text',
            'required': True,
            'default': 'com.chaseburrell.Datacore',
            'help': 'The app bundle identifier (e.g., com.chaseburrell.Datacore)',
        },
        {
            'key': 'use_sandbox',
            'label': 'Use Sandbox (Development)',
            'type': 'toggle',
            'required': False,
            'default': True,
            'help': 'Enable for development builds. Disable for production/TestFlight.',
        },
        {
            'key': 'default_sound',
            'label': 'Default Sound',
            'type': 'select',
            'required': False,
            'default': 'default',
            'options': [
                {'label': 'Default', 'value': 'default'},
                {'label': 'Silent', 'value': 'silent'},
            ],
            'help': 'Default notification sound',
        },
    ]

    def send(self, config, title, body, priority, **kwargs):
        """
        Send a push notification to ALL registered Apple devices.

        The 'config' dict contains APNs credentials. Device tokens are
        loaded from the device_tokens table — this handler fans out
        to every registered device.

        Extra kwargs supported:
            category (str): Notification category for actionable buttons.
            thread_id (str): Group notifications together (e.g., 'vehicle-42').
            deep_link (str): URL to open when notification is tapped.
            image_url (str): URL of image attachment for rich notifications.
            interruption_level (str): 'passive', 'active', 'time-sensitive', 'critical'.
        """
        from apns2.client import APNsClient, NotificationPriority
        from apns2.payload import Payload
        from apns2.credentials import TokenCredentials
        from app.models.device_token import DeviceToken

        # Load APNs credentials
        key_file = config['key_file']
        if not os.path.exists(key_file):
            raise Exception(f"APNs key file not found: {key_file}")

        credentials = TokenCredentials(
            auth_key_path=key_file,
            auth_key_id=config['key_id'],
            team_id=config['team_id'],
        )

        use_sandbox = config.get('use_sandbox', True)
        client = APNsClient(
            credentials=credentials,
            use_sandbox=use_sandbox,
        )

        # Map Datacore priority to APNs
        priority_map = {
            'low': NotificationPriority.Delayed,
            'normal': NotificationPriority.Immediate,
            'high': NotificationPriority.Immediate,
            'critical': NotificationPriority.Immediate,
        }
        apns_priority = priority_map.get(priority, NotificationPriority.Immediate)

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

        # Build APNs payload
        sound = config.get('default_sound', 'default')
        if sound == 'silent':
            sound = None

        # Custom data for the app to handle
        custom_data = {}
        if kwargs.get('deep_link'):
            custom_data['link'] = kwargs['deep_link']
        if kwargs.get('image_url'):
            custom_data['image_url'] = kwargs['image_url']

        payload = Payload(
            alert={'title': title or 'Datacore', 'body': body},
            sound=sound,
            badge=None,  # Let the app manage badge count
            category=kwargs.get('category'),
            thread_id=kwargs.get('thread_id'),
            custom=custom_data if custom_data else None,
            mutable_content=bool(kwargs.get('image_url')),  # Enable for rich notifications
        )

        # Send to all registered devices
        bundle_id = config.get('bundle_id', 'com.chaseburrell.Datacore')
        tokens = DeviceToken.query.all()

        if not tokens:
            logger.warning("APNs: No device tokens registered — skipping push")
            return

        failed_count = 0
        for device in tokens:
            try:
                response = client.send_notification(
                    token_hex=device.token,
                    notification=payload,
                    topic=bundle_id,
                    priority=apns_priority,
                )
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

        if failed_count == len(tokens):
            raise Exception(f"APNs: All {failed_count} device deliveries failed")

        logger.info(f"APNs: Sent to {len(tokens) - failed_count}/{len(tokens)} devices")
