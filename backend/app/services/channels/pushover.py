"""
Pushover notification channel handler.

Sends push notifications via the Pushover API.
Docs: https://pushover.net/api

Pushover is a paid service that delivers real-time push notifications
to iOS, Android, and desktop devices. Users need a Pushover account
(user key) and must create an application (API token) at pushover.net.
"""

import requests

from . import BaseChannel, register_channel


@register_channel
class PushoverChannel(BaseChannel):
    """Handler for Pushover push notifications."""

    CHANNEL_TYPE = 'pushover'
    DISPLAY_NAME = 'Pushover'

    CONFIG_SCHEMA = [
        {
            'key': 'user_key',
            'label': 'User Key',
            'type': 'text',
            'required': True,
            'help': 'Your Pushover user key (found on your Pushover dashboard)',
        },
        {
            'key': 'api_token',
            'label': 'API Token',
            'type': 'password',
            'required': True,
            'help': 'Your Pushover application API token',
        },
        {
            'key': 'device',
            'label': 'Device',
            'type': 'text',
            'required': False,
            'help': 'Target a specific device name (leave blank for all devices)',
        },
        {
            'key': 'default_priority',
            'label': 'Default Priority',
            'type': 'select',
            'required': False,
            'default': '0',
            'options': [
                {'label': 'Lowest (-2)', 'value': '-2'},
                {'label': 'Low (-1)', 'value': '-1'},
                {'label': 'Normal (0)', 'value': '0'},
                {'label': 'High (1)', 'value': '1'},
                {'label': 'Emergency (2)', 'value': '2'},
            ],
            'help': 'Default Pushover priority level for notifications',
        },
        {
            'key': 'default_sound',
            'label': 'Default Sound',
            'type': 'select',
            'required': False,
            'default': 'pushover',
            'options': [
                {'label': 'Pushover (default)', 'value': 'pushover'},
                {'label': 'Bike', 'value': 'bike'},
                {'label': 'Bugle', 'value': 'bugle'},
                {'label': 'Cash Register', 'value': 'cashregister'},
                {'label': 'Classical', 'value': 'classical'},
                {'label': 'Cosmic', 'value': 'cosmic'},
                {'label': 'Falling', 'value': 'falling'},
                {'label': 'Gamelan', 'value': 'gamelan'},
                {'label': 'Incoming', 'value': 'incoming'},
                {'label': 'Intermission', 'value': 'intermission'},
                {'label': 'Magic', 'value': 'magic'},
                {'label': 'Mechanical', 'value': 'mechanical'},
                {'label': 'Piano Bar', 'value': 'pianobar'},
                {'label': 'Siren', 'value': 'siren'},
                {'label': 'Space Alarm', 'value': 'spacealarm'},
                {'label': 'Tugboat', 'value': 'tugboat'},
                {'label': 'Alien', 'value': 'alien'},
                {'label': 'Climb', 'value': 'climb'},
                {'label': 'Persistent', 'value': 'persistent'},
                {'label': 'Echo', 'value': 'echo'},
                {'label': 'Up Down', 'value': 'updown'},
                {'label': 'Vibrate', 'value': 'vibrate'},
                {'label': 'None', 'value': 'none'},
            ],
            'help': 'Notification sound on the device',
        },
        {
            'key': 'retry',
            'label': 'Retry Interval',
            'type': 'number',
            'required': False,
            'help': 'Only used for Emergency priority. Minimum 30 seconds.',
        },
        {
            'key': 'expire',
            'label': 'Expiration',
            'type': 'number',
            'required': False,
            'help': 'Only used for Emergency priority. Maximum 10800 (3 hours).',
        },
        {
            'key': 'html',
            'label': 'HTML Formatting',
            'type': 'toggle',
            'required': False,
            'default': False,
            'help': 'Enable HTML formatting in notification messages',
        },
        {
            'key': 'url',
            'label': 'Supplementary URL',
            'type': 'url',
            'required': False,
            'help': 'A supplementary URL to include with the notification',
        },
        {
            'key': 'url_title',
            'label': 'URL Title',
            'type': 'text',
            'required': False,
            'help': 'Title text for the supplementary URL',
        },
    ]

    def send(self, config, title, body, priority):
        """
        Send a push notification via the Pushover API.

        Args:
            config   (dict): Must contain 'user_key' and 'api_token'.
                             May contain optional fields like 'device', etc.
            title    (str):  Notification title.
            body     (str):  Notification body / message text.
            priority (str):  One of 'low', 'normal', 'high', 'critical'.

        Raises:
            Exception: If the Pushover API returns a non-200 status code.
        """
        # Map Life Hub priority strings to Pushover priority numbers.
        # If the user has set a default_priority in their config, that
        # takes precedence over the automatic mapping.
        priority_map = {'low': -1, 'normal': 0, 'high': 1, 'critical': 2}
        pushover_priority = config.get(
            'default_priority',
            priority_map.get(priority, 0),
        )

        # Build the API payload with required fields
        payload = {
            'token': config['api_token'],
            'user': config['user_key'],
            'title': title or 'Life Hub',
            'message': body,
            'priority': int(pushover_priority),
            'html': 1 if config.get('html') else 0,
        }

        # Add optional fields only if the user configured them
        if config.get('device'):
            payload['device'] = config['device']
        if config.get('default_sound'):
            payload['sound'] = config['default_sound']
        if config.get('url'):
            payload['url'] = config['url']
        if config.get('url_title'):
            payload['url_title'] = config['url_title']

        # Emergency priority (2) requires retry and expire parameters.
        # Pushover enforces retry >= 30s and expire <= 10800s (3 hours).
        if int(pushover_priority) == 2:
            payload['retry'] = int(config.get('retry', 60))
            payload['expire'] = int(config.get('expire', 3600))

        # Send the request to Pushover
        response = requests.post(
            'https://api.pushover.net/1/messages.json',
            data=payload,
        )

        if response.status_code != 200:
            raise Exception(
                f"Pushover API error: {response.status_code} - {response.text}"
            )
