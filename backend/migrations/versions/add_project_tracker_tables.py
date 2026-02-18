"""Add project tracker tables

Creates 7 new tables for the project tracker module:
  - projects: Core project records with status, repo URL, etc.
  - project_tech_stack: Technologies used per project
  - project_tags: Global tags for categorizing projects
  - project_tag_map: Many-to-many join between projects and tags
  - project_kanban_columns: Customizable kanban columns per project
  - project_tasks: Individual tasks within kanban boards
  - project_changelog: Timeline of milestones, releases, and notes

This migration is ADDITIVE ONLY — it creates new tables and indexes.
It does NOT modify any existing tables.

Revision ID: add_project_tracker_tables
Revises: reorder_maintenance_items
Create Date: 2026-02-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'add_project_tracker_tables'
down_revision = 'reorder_maintenance_items'
branch_labels = None
depends_on = None


def upgrade():
    # ── projects ─────────────────────────────────────────────────
    op.create_table(
        'projects',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(255), nullable=False, unique=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='active'),
        sa.Column('visibility', sa.String(50), nullable=True, server_default='private'),
        sa.Column('repo_url', sa.String(500), nullable=True),
        sa.Column('repo_provider', sa.String(50), nullable=True),
        sa.Column('live_url', sa.String(500), nullable=True),
        sa.Column('color', sa.String(7), nullable=True),
        sa.Column('icon', sa.String(100), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('started_at', sa.Date(), nullable=True),
        sa.Column('completed_at', sa.Date(), nullable=True),
        sa.Column('extra_data', postgresql.JSONB(), nullable=True, server_default='{}'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_projects_slug', 'projects', ['slug'])
    op.create_index('ix_projects_status', 'projects', ['status'])

    # ── project_tech_stack ───────────────────────────────────────
    op.create_table(
        'project_tech_stack',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('category', sa.String(50), nullable=True),
        sa.Column('version', sa.String(50), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=True, server_default='0'),
        sa.UniqueConstraint('project_id', 'name', name='uq_project_tech_stack'),
    )
    op.create_index('ix_project_tech_stack_project_id', 'project_tech_stack', ['project_id'])

    # ── project_tags ─────────────────────────────────────────────
    op.create_table(
        'project_tags',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False, unique=True),
        sa.Column('color', sa.String(7), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_project_tags_name', 'project_tags', ['name'])

    # ── project_tag_map (many-to-many join) ──────────────────────
    op.create_table(
        'project_tag_map',
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('tag_id', sa.Integer(), sa.ForeignKey('project_tags.id', ondelete='CASCADE'), primary_key=True),
    )

    # ── project_kanban_columns ───────────────────────────────────
    op.create_table(
        'project_kanban_columns',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('color', sa.String(7), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_done_column', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('wip_limit', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_project_kanban_columns_project_id', 'project_kanban_columns', ['project_id'])

    # ── project_tasks ────────────────────────────────────────────
    op.create_table(
        'project_tasks',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('column_id', sa.Integer(), sa.ForeignKey('project_kanban_columns.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('description_json', postgresql.JSONB(), nullable=True),
        sa.Column('description_text', sa.Text(), nullable=True),
        sa.Column('priority', sa.String(20), nullable=False, server_default='normal'),
        sa.Column('sort_order', sa.Float(), nullable=False, server_default='0'),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('labels', postgresql.JSONB(), nullable=True, server_default='[]'),
        sa.Column('estimated_hours', sa.Float(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('extra_data', postgresql.JSONB(), nullable=True, server_default='{}'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_project_tasks_project_id', 'project_tasks', ['project_id'])
    op.create_index('ix_project_tasks_column_id', 'project_tasks', ['column_id'])

    # ── project_changelog ────────────────────────────────────────
    op.create_table(
        'project_changelog',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('entry_type', sa.String(50), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('version', sa.String(50), nullable=True),
        sa.Column('entry_date', sa.Date(), nullable=False),
        sa.Column('extra_data', postgresql.JSONB(), nullable=True, server_default='{}'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_project_changelog_project_id', 'project_changelog', ['project_id'])
    op.create_index('ix_project_changelog_entry_date', 'project_changelog', ['entry_date'])


def downgrade():
    # Drop in reverse dependency order (children before parents)
    op.drop_table('project_changelog')
    op.drop_table('project_tasks')
    op.drop_table('project_kanban_columns')
    op.drop_table('project_tag_map')
    op.drop_table('project_tags')
    op.drop_table('project_tech_stack')
    op.drop_table('projects')
