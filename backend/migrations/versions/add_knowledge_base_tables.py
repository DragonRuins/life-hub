"""Add knowledge base tables

Creates 8 new tables for the knowledge base / wiki module:
  - kb_categories: Hierarchical categories with unlimited nesting
  - kb_tags: Tags for cross-referencing articles
  - kb_article_tags: Many-to-many join between articles and tags
  - kb_articles: Core article records with TipTap content, status, metadata
  - kb_article_links: Tracks wiki-style [[internal links]] for backlinks
  - kb_article_revisions: Lightweight revision history (capped at 20)
  - kb_bookmarks: Favorited articles for quick access
  - kb_recent_views: Recently viewed article tracking

This migration is ADDITIVE ONLY — it creates new tables and indexes.
It does NOT modify any existing tables.

Revision ID: add_knowledge_base_tables
Revises: add_vehicle_is_primary
Create Date: 2026-02-18
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'add_knowledge_base_tables'
down_revision = 'add_vehicle_is_primary'
branch_labels = None
depends_on = None


def upgrade():
    # ── kb_categories ──────────────────────────────────────────────
    op.create_table(
        'kb_categories',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(255), nullable=False, unique=True),
        sa.Column('parent_id', sa.Integer(), sa.ForeignKey('kb_categories.id'), nullable=True),
        sa.Column('position', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('icon', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_kb_categories_parent_id', 'kb_categories', ['parent_id'])
    op.create_index('ix_kb_categories_slug', 'kb_categories', ['slug'])

    # ── kb_tags ────────────────────────────────────────────────────
    op.create_table(
        'kb_tags',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False, unique=True),
        sa.Column('color', sa.String(7), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_kb_tags_name', 'kb_tags', ['name'])

    # ── kb_articles ────────────────────────────────────────────────
    op.create_table(
        'kb_articles',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('slug', sa.String(500), nullable=False, unique=True),
        sa.Column('content_json', postgresql.JSONB(), nullable=True),
        sa.Column('content_text', sa.Text(), nullable=True),
        sa.Column('search_vector', postgresql.TSVECTOR(), nullable=True),
        sa.Column('category_id', sa.Integer(), sa.ForeignKey('kb_categories.id'), nullable=True),
        sa.Column('parent_id', sa.Integer(), sa.ForeignKey('kb_articles.id'), nullable=True),
        sa.Column('position', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('status', sa.String(50), nullable=False, server_default='draft'),
        sa.Column('source_url', sa.String(1000), nullable=True),
        sa.Column('source_verified_at', sa.DateTime(), nullable=True),
        sa.Column('is_template', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('template_name', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_kb_articles_slug', 'kb_articles', ['slug'])
    op.create_index('ix_kb_articles_category_id', 'kb_articles', ['category_id'])
    op.create_index('ix_kb_articles_parent_id', 'kb_articles', ['parent_id'])
    op.create_index('ix_kb_articles_status', 'kb_articles', ['status'])
    op.create_index('ix_kb_articles_is_template', 'kb_articles', ['is_template'])
    op.create_index('ix_kb_articles_updated_at', 'kb_articles', ['updated_at'])
    op.create_index('ix_kb_articles_search_vector', 'kb_articles', ['search_vector'], postgresql_using='gin')

    # ── kb_article_tags (many-to-many join) ────────────────────────
    op.create_table(
        'kb_article_tags',
        sa.Column('article_id', sa.Integer(), sa.ForeignKey('kb_articles.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('tag_id', sa.Integer(), sa.ForeignKey('kb_tags.id', ondelete='CASCADE'), primary_key=True),
    )

    # ── kb_article_links (wiki link tracking) ──────────────────────
    op.create_table(
        'kb_article_links',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('source_id', sa.Integer(), sa.ForeignKey('kb_articles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('target_id', sa.Integer(), sa.ForeignKey('kb_articles.id', ondelete='CASCADE'), nullable=False),
        sa.UniqueConstraint('source_id', 'target_id', name='uq_kb_article_link'),
    )
    op.create_index('ix_kb_article_links_source', 'kb_article_links', ['source_id'])
    op.create_index('ix_kb_article_links_target', 'kb_article_links', ['target_id'])

    # ── kb_article_revisions ───────────────────────────────────────
    op.create_table(
        'kb_article_revisions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('article_id', sa.Integer(), sa.ForeignKey('kb_articles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('revision_number', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('content_json', postgresql.JSONB(), nullable=True),
        sa.Column('content_text', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.UniqueConstraint('article_id', 'revision_number', name='uq_kb_revision'),
    )
    op.create_index('ix_kb_revisions_article_id', 'kb_article_revisions', ['article_id'])

    # ── kb_bookmarks ───────────────────────────────────────────────
    op.create_table(
        'kb_bookmarks',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('article_id', sa.Integer(), sa.ForeignKey('kb_articles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.UniqueConstraint('article_id', name='uq_kb_bookmark_article'),
    )
    op.create_index('ix_kb_bookmarks_article_id', 'kb_bookmarks', ['article_id'])

    # ── kb_recent_views ────────────────────────────────────────────
    op.create_table(
        'kb_recent_views',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('article_id', sa.Integer(), sa.ForeignKey('kb_articles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('viewed_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_kb_recent_views_article_id', 'kb_recent_views', ['article_id'])
    op.create_index('ix_kb_recent_views_viewed_at', 'kb_recent_views', ['viewed_at'])


def downgrade():
    # Drop in reverse dependency order (children before parents)
    op.drop_table('kb_recent_views')
    op.drop_table('kb_bookmarks')
    op.drop_table('kb_article_revisions')
    op.drop_table('kb_article_links')
    op.drop_table('kb_article_tags')
    op.drop_table('kb_articles')
    op.drop_table('kb_tags')
    op.drop_table('kb_categories')
