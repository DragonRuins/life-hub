"""
SMS notification channel handler (stub).

This is a placeholder for future SMS notification support.
The CONFIG_SCHEMA defines the fields that will be needed when
SMS is implemented, but every field is marked with 'coming_soon': True
so the frontend can display them as disabled / greyed out.

Planned providers: Twilio, Vonage (Nexmo).
"""

from . import BaseChannel, register_channel


@register_channel
class SMSChannel(BaseChannel):
    """Stub handler for SMS notifications (not yet implemented)."""

    CHANNEL_TYPE = 'sms'
    DISPLAY_NAME = 'SMS'

    CONFIG_SCHEMA = [
        {
            'key': 'provider',
            'label': 'Provider',
            'type': 'select',
            'required': False,
            'coming_soon': True,
            'options': [
                {'label': 'Twilio', 'value': 'twilio'},
                {'label': 'Vonage', 'value': 'vonage'},
            ],
            'help': 'SMS service provider (coming soon)',
        },
        {
            'key': 'account_sid',
            'label': 'Account SID',
            'type': 'text',
            'required': False,
            'coming_soon': True,
            'help': 'Provider account SID or API key',
        },
        {
            'key': 'auth_token',
            'label': 'Auth Token',
            'type': 'password',
            'required': False,
            'coming_soon': True,
            'help': 'Provider authentication token or API secret',
        },
        {
            'key': 'from_number',
            'label': 'From Number',
            'type': 'text',
            'required': False,
            'coming_soon': True,
            'help': 'Sender phone number (must be registered with provider)',
        },
        {
            'key': 'to_number',
            'label': 'To Number',
            'type': 'text',
            'required': False,
            'coming_soon': True,
            'help': 'Recipient phone number (include country code, e.g. +1)',
        },
    ]

    def send(self, config, title, body, priority):
        """
        SMS sending is not yet implemented.

        Raises:
            NotImplementedError: Always, until a provider integration
                                 is built in a future update.
        """
        raise NotImplementedError(
            "SMS notifications are not yet implemented. "
            "This channel type is planned for a future update."
        )
