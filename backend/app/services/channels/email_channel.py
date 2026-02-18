"""
Email notification channel handler.

Sends notifications via SMTP using Python's built-in smtplib.
Supports TLS, optional authentication, HTML emails, CC recipients,
and configurable subject prefixes.

No external dependencies required -- uses only the Python standard library.
"""

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from . import BaseChannel, register_channel


@register_channel
class EmailChannel(BaseChannel):
    """Handler for email (SMTP) notifications."""

    CHANNEL_TYPE = 'email'
    DISPLAY_NAME = 'Email'

    CONFIG_SCHEMA = [
        {
            'key': 'smtp_host',
            'label': 'SMTP Host',
            'type': 'text',
            'required': True,
            'help': 'SMTP server hostname (e.g., smtp.gmail.com)',
        },
        {
            'key': 'smtp_port',
            'label': 'SMTP Port',
            'type': 'number',
            'required': True,
            'default': 587,
            'help': 'SMTP server port (587 for TLS, 465 for SSL, 25 for unencrypted)',
        },
        {
            'key': 'smtp_username',
            'label': 'SMTP Username',
            'type': 'text',
            'required': False,
            'help': 'Username for SMTP authentication (often your email address)',
        },
        {
            'key': 'smtp_password',
            'label': 'SMTP Password',
            'type': 'password',
            'required': False,
            'help': 'Password or app-specific password for SMTP authentication',
        },
        {
            'key': 'use_tls',
            'label': 'Use TLS',
            'type': 'toggle',
            'required': False,
            'default': True,
            'help': 'Enable STARTTLS encryption (recommended for port 587)',
        },
        {
            'key': 'from_address',
            'label': 'From Address',
            'type': 'text',
            'required': True,
            'help': 'Sender email address',
        },
        {
            'key': 'from_name',
            'label': 'From Name',
            'type': 'text',
            'required': False,
            'default': 'Datacore',
            'help': 'Display name for the sender',
        },
        {
            'key': 'to_address',
            'label': 'To Address',
            'type': 'text',
            'required': True,
            'help': 'Recipient email address',
        },
        {
            'key': 'cc_addresses',
            'label': 'CC Addresses',
            'type': 'text',
            'required': False,
            'help': 'Comma-separated list of CC email addresses',
        },
        {
            'key': 'html_enabled',
            'label': 'HTML Email',
            'type': 'toggle',
            'required': False,
            'default': False,
            'help': 'Send the notification body as HTML instead of plain text',
        },
        {
            'key': 'email_subject_prefix',
            'label': 'Subject Prefix',
            'type': 'text',
            'required': False,
            'help': 'Prefix added to every email subject, e.g. "[Datacore] "',
        },
    ]

    def send(self, config, title, body, priority):
        """
        Send a notification email via SMTP.

        Constructs a MIME message (plain text or HTML) and delivers it
        through the configured SMTP server.

        Args:
            config   (dict): SMTP connection details and email addresses.
            title    (str):  Used as the email subject line.
            body     (str):  Email body content.
            priority (str):  Priority level (included in subject if no title).

        Raises:
            smtplib.SMTPException: If the SMTP transaction fails.
        """
        # -- Build the subject line --
        prefix = config.get('email_subject_prefix', '')
        subject = f"{prefix}{title}" if title else f"{prefix}Datacore Notification"

        # -- Construct the MIME message --
        msg = MIMEMultipart()

        # Format the "From" header with display name if provided
        from_name = config.get('from_name', 'Datacore')
        from_address = config['from_address']
        msg['From'] = f"{from_name} <{from_address}>"

        msg['To'] = config['to_address']
        msg['Subject'] = subject

        # Add CC recipients if configured
        cc_addresses = config.get('cc_addresses', '')
        if cc_addresses:
            msg['Cc'] = cc_addresses

        # Attach the body as HTML or plain text
        if config.get('html_enabled'):
            msg.attach(MIMEText(body, 'html'))
        else:
            msg.attach(MIMEText(body, 'plain'))

        # -- Build the full recipient list (To + CC) --
        all_recipients = [config['to_address']]
        if cc_addresses:
            # Split comma-separated CC addresses and strip whitespace
            all_recipients.extend(
                addr.strip() for addr in cc_addresses.split(',') if addr.strip()
            )

        # -- Connect to SMTP server and send --
        smtp_host = config['smtp_host']
        smtp_port = int(config.get('smtp_port', 587))
        use_tls = config.get('use_tls', True)

        server = smtplib.SMTP(smtp_host, smtp_port)
        try:
            # Identify ourselves to the server
            server.ehlo()

            # Upgrade to TLS if enabled
            if use_tls:
                server.starttls()
                server.ehlo()  # Re-identify after TLS handshake

            # Authenticate if credentials are provided
            if config.get('smtp_username') and config.get('smtp_password'):
                server.login(config['smtp_username'], config['smtp_password'])

            # Send the email
            server.sendmail(from_address, all_recipients, msg.as_string())
        finally:
            # Always close the connection
            server.quit()
