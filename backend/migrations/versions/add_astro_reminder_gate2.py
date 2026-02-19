"""Add second launch reminder gate to astro_settings

Adds launch_reminder_minutes_2 column for an optional second
notification gate (e.g. 30 minutes before launch).  NULL = disabled.

Revision ID: add_astro_reminder_gate2
Revises: add_astrometrics_tables
"""
from alembic import op
import sqlalchemy as sa

revision = 'add_astro_reminder_gate2'
down_revision = 'add_astrometrics_tables'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('astro_settings',
                  sa.Column('launch_reminder_minutes_2', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('astro_settings', 'launch_reminder_minutes_2')
