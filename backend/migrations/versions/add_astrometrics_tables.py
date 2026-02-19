"""Add astrometrics tables

Creates 3 new tables for the Astrometrics module:
  - astro_cache: Cached API responses from NASA, Launch Library 2, etc.
  - astro_apod_favorites: User's saved APOD favorites
  - astro_settings: Singleton config (API keys, refresh intervals, thresholds)

This migration is ADDITIVE ONLY -- it creates new tables and indexes.
It does NOT modify any existing tables.

Revision ID: add_astrometrics_tables
Revises: add_infrastructure_tables
Create Date: 2026-02-19
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic
revision = 'add_astrometrics_tables'
down_revision = 'add_infrastructure_tables'
branch_labels = None
depends_on = None


def upgrade():
    # ── astro_cache ─────────────────────────────────────────────
    op.create_table(
        'astro_cache',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('source', sa.String(50), nullable=False),
        sa.Column('cache_key', sa.String(255), nullable=False),
        sa.Column('data', sa.JSON(), nullable=False),
        sa.Column('fetched_at', sa.DateTime(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('source', 'cache_key', name='uq_astro_cache_source_key'),
    )
    op.create_index('idx_astro_cache_expires', 'astro_cache', ['expires_at'])

    # ── astro_apod_favorites ────────────────────────────────────
    op.create_table(
        'astro_apod_favorites',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('date', sa.String(10), unique=True, nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('url', sa.String(1000), nullable=False),
        sa.Column('hdurl', sa.String(1000)),
        sa.Column('media_type', sa.String(20), nullable=False),
        sa.Column('explanation', sa.Text()),
        sa.Column('thumbnail_url', sa.String(1000)),
        sa.Column('copyright', sa.String(500)),
        sa.Column('created_at', sa.DateTime()),
    )

    # ── astro_settings ──────────────────────────────────────────
    op.create_table(
        'astro_settings',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('nasa_api_key', sa.String(100), default='DEMO_KEY'),
        sa.Column('home_latitude', sa.Float(), default=0.0),
        sa.Column('home_longitude', sa.Float(), default=0.0),
        sa.Column('refresh_apod', sa.Integer(), default=86400),
        sa.Column('refresh_neo', sa.Integer(), default=21600),
        sa.Column('refresh_iss_position', sa.Integer(), default=15),
        sa.Column('refresh_people_in_space', sa.Integer(), default=3600),
        sa.Column('refresh_launches', sa.Integer(), default=3600),
        sa.Column('launch_reminder_hours', sa.Integer(), default=24),
        sa.Column('neo_close_approach_threshold_ld', sa.Float(), default=5.0),
        sa.Column('updated_at', sa.DateTime()),
    )


def downgrade():
    op.drop_table('astro_settings')
    op.drop_table('astro_apod_favorites')
    op.drop_index('idx_astro_cache_expires', table_name='astro_cache')
    op.drop_table('astro_cache')
