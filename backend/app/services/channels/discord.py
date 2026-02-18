"""
Discord notification channel handler.

Sends notifications to a Discord channel via webhook with rich embeds.
Docs: https://discord.com/developers/docs/resources/webhook

Discord webhooks are free and don't require a bot -- just create a
webhook in your Discord server's channel settings and paste the URL
into the channel config.
"""

from datetime import datetime, timezone

import requests

from . import BaseChannel, register_channel


# Catppuccin-inspired colors mapped to notification priority levels.
# These are used as the embed sidebar color in Discord.
PRIORITY_COLORS = {
    'low': 0x94E2D5,       # Teal
    'normal': 0x89B4FA,    # Blue
    'high': 0xFAB387,      # Peach
    'critical': 0xF38BA8,  # Red
}


@register_channel
class DiscordChannel(BaseChannel):
    """Handler for Discord webhook notifications."""

    CHANNEL_TYPE = 'discord'
    DISPLAY_NAME = 'Discord'

    CONFIG_SCHEMA = [
        {
            'key': 'webhook_url',
            'label': 'Webhook URL',
            'type': 'url',
            'required': True,
            'help': 'Discord webhook URL (from channel settings > Integrations)',
        },
        {
            'key': 'bot_name',
            'label': 'Bot Name',
            'type': 'text',
            'required': False,
            'default': 'Datacore',
            'help': 'Custom username shown on the webhook message',
        },
        {
            'key': 'avatar_url',
            'label': 'Avatar URL',
            'type': 'url',
            'required': False,
            'help': 'Custom avatar image URL for the webhook',
        },
        {
            'key': 'embed_color',
            'label': 'Default Embed Color',
            'type': 'color',
            'required': False,
            'help': 'Default color for the embed sidebar. Can be overridden per-rule.',
        },
        {
            'key': 'embed_footer_text',
            'label': 'Footer Text',
            'type': 'text',
            'required': False,
            'default': 'Datacore Notifications',
            'help': 'Text shown in the embed footer',
        },
        {
            'key': 'embed_footer_icon_url',
            'label': 'Footer Icon URL',
            'type': 'url',
            'required': False,
            'help': 'Small icon shown next to the footer text',
        },
        {
            'key': 'embed_thumbnail_url',
            'label': 'Thumbnail URL',
            'type': 'url',
            'required': False,
            'help': 'Thumbnail image shown in the top-right of the embed',
        },
        {
            'key': 'include_timestamp',
            'label': 'Include Timestamp',
            'type': 'toggle',
            'required': False,
            'default': True,
            'help': 'Show a timestamp in the embed footer',
        },
        {
            'key': 'mention_role_id',
            'label': 'Mention Role ID',
            'type': 'text',
            'required': False,
            'help': 'Role ID to @mention for high/critical notifications',
        },
        {
            'key': 'mention_user_id',
            'label': 'Mention User ID',
            'type': 'text',
            'required': False,
            'help': 'User ID to @mention for high/critical notifications',
        },
        {
            'key': 'thread_name',
            'label': 'Thread Name',
            'type': 'text',
            'required': False,
            'help': 'Post to a specific forum/thread (creates if needed)',
        },
    ]

    def send(self, config, title, body, priority):
        """
        Send a notification to Discord via webhook with a rich embed.

        For high/critical priority notifications, role and user mentions
        are prepended as plain text content (Discord requires mentions
        to be outside the embed to actually ping users).

        Args:
            config   (dict): Must contain 'webhook_url'. May contain
                             optional display/mention settings.
            title    (str):  Notification title (used as embed title).
            body     (str):  Notification body (used as embed description).
            priority (str):  One of 'low', 'normal', 'high', 'critical'.

        Raises:
            Exception: If Discord returns a non-2xx status code.
        """
        # -- Determine embed color --
        # Use user's custom color if set, otherwise map from priority.
        embed_color = PRIORITY_COLORS.get(priority, PRIORITY_COLORS['normal'])
        if config.get('embed_color'):
            # Config stores hex string like '#89b4fa'; strip '#' and parse.
            try:
                embed_color = int(config['embed_color'].lstrip('#'), 16)
            except (ValueError, AttributeError):
                pass  # Fall back to priority-based color

        # -- Build the embed object --
        embed = {
            'title': title or 'Datacore Notification',
            'description': body,
            'color': embed_color,
        }

        # Footer
        footer_text = config.get('embed_footer_text', 'Datacore Notifications')
        if footer_text:
            embed['footer'] = {'text': footer_text}
            if config.get('embed_footer_icon_url'):
                embed['footer']['icon_url'] = config['embed_footer_icon_url']

        # Thumbnail (small image in top-right corner of embed)
        if config.get('embed_thumbnail_url'):
            embed['thumbnail'] = {'url': config['embed_thumbnail_url']}

        # Timestamp (shows in footer area, Discord formats it locally)
        include_timestamp = config.get('include_timestamp', True)
        if include_timestamp:
            embed['timestamp'] = datetime.now(timezone.utc).isoformat()

        # -- Build mentions for high/critical priority --
        mentions = []
        if priority in ('high', 'critical'):
            if config.get('mention_role_id'):
                mentions.append(f"<@&{config['mention_role_id']}>")
            if config.get('mention_user_id'):
                mentions.append(f"<@{config['mention_user_id']}>")

        # -- Assemble the full webhook payload --
        payload = {
            'embeds': [embed],
        }

        # Mentions go in 'content' (plain text above the embed) so
        # Discord actually pings the mentioned users/roles.
        if mentions:
            payload['content'] = ' '.join(mentions)

        # Optional webhook display overrides
        if config.get('bot_name'):
            payload['username'] = config['bot_name']
        if config.get('avatar_url'):
            payload['avatar_url'] = config['avatar_url']

        # Build the final URL (add thread query param if needed)
        webhook_url = config['webhook_url']
        params = {}
        if config.get('thread_name'):
            params['thread_name'] = config['thread_name']

        # Send the webhook request
        response = requests.post(webhook_url, json=payload, params=params)

        # Discord returns 204 No Content on success, but some webhook
        # endpoints return 200. Treat any 2xx as success.
        if not response.ok:
            raise Exception(
                f"Discord webhook error: {response.status_code} - {response.text}"
            )
