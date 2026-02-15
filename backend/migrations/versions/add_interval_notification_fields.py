"""Add notification delivery config to vehicle_maintenance_intervals.

Adds 5 columns that let intervals dispatch directly to channels
instead of going through the generic rule system:
  - notification_channel_ids: JSON array of channel IDs
  - notification_priority: string priority level
  - notification_title_template: message title with {{variables}}
  - notification_body_template: message body with {{variables}}
  - notification_timing: 'immediate' or 'scheduled'

Revision ID: add_interval_notification_fields
Revises: add_maintenance_intervals
Create Date: 2026-02-15
"""
from alembic import op
import sqlalchemy as sa

revision = 'add_interval_notification_fields'
down_revision = 'add_maintenance_intervals'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('vehicle_maintenance_intervals',
        sa.Column('notification_channel_ids', sa.JSON(), nullable=True))
    op.add_column('vehicle_maintenance_intervals',
        sa.Column('notification_priority', sa.String(20), nullable=True))
    op.add_column('vehicle_maintenance_intervals',
        sa.Column('notification_title_template', sa.String(500), nullable=True))
    op.add_column('vehicle_maintenance_intervals',
        sa.Column('notification_body_template', sa.Text(), nullable=True))
    op.add_column('vehicle_maintenance_intervals',
        sa.Column('notification_timing', sa.String(20), nullable=False, server_default='immediate'))


def downgrade():
    op.drop_column('vehicle_maintenance_intervals', 'notification_timing')
    op.drop_column('vehicle_maintenance_intervals', 'notification_body_template')
    op.drop_column('vehicle_maintenance_intervals', 'notification_title_template')
    op.drop_column('vehicle_maintenance_intervals', 'notification_priority')
    op.drop_column('vehicle_maintenance_intervals', 'notification_channel_ids')
