"""Add notification_timing column to vehicle_maintenance_intervals.

Allows each interval to choose when notifications fire:
  - 'immediate': as soon as a threshold is detected (fuel-up, maintenance log)
  - 'scheduled': only during the daily 9 AM scheduler check

Revision ID: add_notification_timing
Revises: add_interval_notification_fields
Create Date: 2026-02-15
"""
from alembic import op
import sqlalchemy as sa

revision = 'add_notification_timing'
down_revision = 'add_interval_notification_fields'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('vehicle_maintenance_intervals',
        sa.Column('notification_timing', sa.String(20), nullable=False, server_default='immediate'))


def downgrade():
    op.drop_column('vehicle_maintenance_intervals', 'notification_timing')
