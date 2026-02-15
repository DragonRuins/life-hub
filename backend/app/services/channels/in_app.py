"""
In-App notification channel handler.

In-app notifications are delivered by writing a row to the
notification_log table. The notification dispatcher already handles
that write, so this handler's send() method is effectively a no-op --
it returns successfully because the log entry *is* the notification.

The CONFIG_SCHEMA here is intentionally minimal. It exposes a single
toggle (group_similar) that the frontend can use to let users choose
whether similar notifications should be collapsed in their feed.
"""

from . import BaseChannel, register_channel


@register_channel
class InAppChannel(BaseChannel):
    """Handler for in-app (on-screen) notifications."""

    CHANNEL_TYPE = 'in_app'
    DISPLAY_NAME = 'In-App'

    CONFIG_SCHEMA = [
        {
            'key': 'group_similar',
            'label': 'Group Similar',
            'type': 'toggle',
            'required': False,
            'default': False,
            'help': 'Group similar notifications together in the feed',
        },
    ]

    def send(self, config, title, body, priority):
        """
        No-op send for in-app notifications.

        The dispatcher writes a notification_log row before calling
        send(), so the notification is already "delivered" by the time
        we get here. We just return successfully.

        Args:
            config   (dict): Channel configuration (currently unused).
            title    (str):  Notification title.
            body     (str):  Notification body.
            priority (str):  Priority level string.
        """
        # Nothing to do -- the notification_log entry IS the delivery.
        return
