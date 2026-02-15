"""Add notification system tables

Creates 5 new tables for the notification system:
  - notification_channels: delivery channel configuration
  - notification_rules: trigger rules for notifications
  - notification_rule_channels: many-to-many join with overrides
  - notification_log: immutable delivery history
  - notification_settings: global settings singleton

This migration is ADDITIVE ONLY — it creates new tables and indexes.
It does NOT modify any existing tables.

Revision ID: add_notification_tables
Revises: add_tire_set_mileage_tracking
Create Date: 2026-02-14
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'add_notification_tables'
down_revision = 'add_tire_set_mileage_tracking'
branch_labels = None
depends_on = None


def upgrade():
    # ── notification_channels ──────────────────────────────────
    # Stores configured delivery channels (Pushover, Discord, etc.)
    op.create_table(
        'notification_channels',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('channel_type', sa.String(50), nullable=False),
        sa.Column('config', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_notification_channels_channel_type', 'notification_channels', ['channel_type'])

    # ── notification_rules ─────────────────────────────────────
    # Defines when and why notifications fire
    op.create_table(
        'notification_rules',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('module', sa.String(50), nullable=True),
        sa.Column('rule_type', sa.String(50), nullable=False),
        sa.Column('schedule_config', sa.JSON(), nullable=True),
        sa.Column('event_name', sa.String(100), nullable=True),
        sa.Column('conditions', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('title_template', sa.String(500), nullable=True),
        sa.Column('body_template', sa.Text(), nullable=False),
        sa.Column('priority', sa.String(20), nullable=False, server_default='normal'),
        sa.Column('cooldown_minutes', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('last_fired_at', sa.DateTime(), nullable=True),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_notification_rules_rule_type', 'notification_rules', ['rule_type'])
    op.create_index('ix_notification_rules_event_name', 'notification_rules', ['event_name'])
    op.create_index('ix_notification_rules_module', 'notification_rules', ['module'])

    # ── notification_rule_channels (join table) ────────────────
    # Links rules to channels with optional per-rule overrides
    op.create_table(
        'notification_rule_channels',
        sa.Column('rule_id', sa.Integer(), sa.ForeignKey('notification_rules.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('channel_id', sa.Integer(), sa.ForeignKey('notification_channels.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('channel_overrides', sa.JSON(), nullable=True, server_default='{}'),
    )

    # ── notification_log ───────────────────────────────────────
    # Immutable history of every notification sent
    op.create_table(
        'notification_log',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('rule_id', sa.Integer(), sa.ForeignKey('notification_rules.id', ondelete='SET NULL'), nullable=True),
        sa.Column('channel_id', sa.Integer(), sa.ForeignKey('notification_channels.id', ondelete='SET NULL'), nullable=True),
        sa.Column('channel_type', sa.String(50), nullable=False),
        sa.Column('title', sa.String(500), nullable=True),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('priority', sa.String(20), nullable=False, server_default='normal'),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('delivery_duration_ms', sa.Integer(), nullable=True),
        sa.Column('event_data', sa.JSON(), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('sent_at', sa.DateTime(), nullable=False),
        sa.Column('read_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_notification_log_sent_at', 'notification_log', [sa.text('sent_at DESC')])
    op.create_index('ix_notification_log_status', 'notification_log', ['status'])
    op.create_index('ix_notification_log_rule_id', 'notification_log', ['rule_id'])
    op.create_index('ix_notification_log_is_read_channel_type', 'notification_log', ['is_read', 'channel_type'])

    # ── notification_settings (singleton) ──────────────────────
    # Global notification preferences — always one row with id=1
    op.create_table(
        'notification_settings',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('default_priority', sa.String(20), nullable=True, server_default='normal'),
        sa.Column('default_channel_ids', sa.JSON(), nullable=True, server_default='[]'),
        sa.Column('quiet_hours_start', sa.String(5), nullable=True),
        sa.Column('quiet_hours_end', sa.String(5), nullable=True),
        sa.Column('quiet_hours_timezone', sa.String(50), nullable=True, server_default="'America/Chicago'"),
        sa.Column('retention_days', sa.Integer(), nullable=True, server_default='90'),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )

    # Seed the singleton settings row with defaults
    op.execute(
        "INSERT INTO notification_settings (id, enabled, default_priority, retention_days) "
        "VALUES (1, true, 'normal', 90)"
    )


def downgrade():
    # Drop tables in reverse dependency order
    op.drop_table('notification_log')
    op.drop_table('notification_rule_channels')
    op.drop_table('notification_rules')
    op.drop_table('notification_channels')
    op.drop_table('notification_settings')
