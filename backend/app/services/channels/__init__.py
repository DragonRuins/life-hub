"""
Notification channel handlers package.

This module defines the base class for all notification channels,
the channel registry (which maps type strings like 'pushover' to
handler instances), and helper functions used by the notification
dispatcher and the API layer.

How it works:
    1. Each channel type (Pushover, Discord, etc.) lives in its own
       file and subclasses BaseChannel.
    2. The @register_channel decorator adds the handler to a global
       registry so the dispatcher can look it up by type string.
    3. CONFIG_SCHEMA on each handler describes the settings fields
       that the frontend renders as a dynamic form.
    4. The send() method on each handler does the actual delivery
       (HTTP request to Pushover, Discord webhook, SMTP, etc.).
"""


# ---------------------------------------------------------------------------
# Base class
# ---------------------------------------------------------------------------

class BaseChannel:
    """
    Abstract base for notification channel handlers.

    Each channel type (Pushover, Discord, etc.) subclasses this and defines:
    - CHANNEL_TYPE: string identifier (e.g., 'pushover')
    - DISPLAY_NAME: human-readable name (e.g., 'Pushover')
    - CONFIG_SCHEMA: list of field definitions that drive the frontend
      settings form
    - send(): method that delivers the notification
    - validate_config(): validates required fields before saving
    """

    # -- Subclasses MUST override these --
    CHANNEL_TYPE = None   # e.g. 'pushover'
    DISPLAY_NAME = None   # e.g. 'Pushover'
    CONFIG_SCHEMA = []    # List of field-definition dicts

    def send(self, config, title, body, priority):
        """
        Send a notification through this channel.

        Args:
            config (dict): Channel-specific configuration (API keys, URLs, etc.)
            title  (str):  Notification title / subject line.
            body   (str):  Notification body / message content.
            priority (str): One of 'low', 'normal', 'high', 'critical'.

        Must be overridden by every subclass.
        """
        raise NotImplementedError

    def validate_config(self, config):
        """
        Validate that all required CONFIG_SCHEMA fields are present in config.

        Args:
            config (dict): The user-supplied configuration values.

        Returns:
            list[str]: A list of human-readable error messages.
                       Empty list means the config is valid.
        """
        errors = []
        for field in self.CONFIG_SCHEMA:
            if field.get('required') and not config.get(field['key']):
                errors.append(f"{field['label']} is required")
        return errors


# ---------------------------------------------------------------------------
# Channel registry
# ---------------------------------------------------------------------------

# Maps channel_type strings (e.g. 'pushover') to handler *instances*.
CHANNEL_REGISTRY = {}


def register_channel(cls):
    """
    Class decorator that registers a channel handler.

    Usage:
        @register_channel
        class PushoverChannel(BaseChannel):
            CHANNEL_TYPE = 'pushover'
            ...

    The decorator instantiates the class and stores it in
    CHANNEL_REGISTRY keyed by CHANNEL_TYPE.
    """
    instance = cls()
    CHANNEL_REGISTRY[cls.CHANNEL_TYPE] = instance
    return cls


def get_channel_handler(channel_type):
    """
    Get a channel handler instance by its type string.

    Args:
        channel_type (str): e.g. 'pushover', 'discord', 'email'

    Returns:
        BaseChannel: The handler instance.

    Raises:
        ValueError: If no handler is registered for the given type.
    """
    handler = CHANNEL_REGISTRY.get(channel_type)
    if not handler:
        raise ValueError(f"Unknown channel type: {channel_type}")
    return handler


def get_all_schemas():
    """
    Return CONFIG_SCHEMA metadata for every registered channel type.

    Used by the /api/notifications/channels/schemas endpoint so the
    frontend can dynamically render settings forms without hard-coding
    any channel-specific knowledge.

    Returns:
        dict: Keyed by channel_type string, each value contains
              display_name, channel_type, and schema (list of fields).
    """
    return {
        key: {
            'display_name': handler.DISPLAY_NAME,
            'channel_type': handler.CHANNEL_TYPE,
            'schema': handler.CONFIG_SCHEMA,
        }
        for key, handler in CHANNEL_REGISTRY.items()
    }


# ---------------------------------------------------------------------------
# Import all handler modules so the @register_channel decorators run.
# These imports MUST stay at the bottom of this file -- the classes and
# registry helpers above need to exist before the handler modules try
# to use them.
# ---------------------------------------------------------------------------

from . import in_app, pushover, discord, email_channel, sms  # noqa: E402, F401
