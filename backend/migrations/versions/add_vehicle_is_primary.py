"""Add is_primary column to vehicles table

Adds a boolean flag so users can mark one vehicle as the "primary"
(favorite) for dashboard display filtering.

Revision ID: add_vehicle_is_primary
Revises: add_project_tracker_tables
Create Date: 2026-02-18
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_vehicle_is_primary'
down_revision = 'add_project_tracker_tables'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('vehicles', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_primary', sa.Boolean(), nullable=True, server_default='false'))

    # Set all existing vehicles to false
    op.execute("UPDATE vehicles SET is_primary = false WHERE is_primary IS NULL")


def downgrade():
    with op.batch_alter_table('vehicles', schema=None) as batch_op:
        batch_op.drop_column('is_primary')
