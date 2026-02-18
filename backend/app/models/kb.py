"""
Knowledge Base Module - Database Models

A wiki-style knowledge management system with hierarchical categories,
wiki-style internal linking, full-text search, revision history,
bookmarks, and article templates.

Content is stored as TipTap JSON (JSONB) with a denormalized
plain-text column and a tsvector column for PostgreSQL full-text search.
"""
from datetime import datetime, timezone
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from app import db


# ---------------------------------------------------------------------------
# Association table: many-to-many between articles and tags
# ---------------------------------------------------------------------------
kb_article_tags = db.Table(
    'kb_article_tags',
    db.Column(
        'article_id', db.Integer,
        db.ForeignKey('kb_articles.id', ondelete='CASCADE'),
        primary_key=True
    ),
    db.Column(
        'tag_id', db.Integer,
        db.ForeignKey('kb_tags.id', ondelete='CASCADE'),
        primary_key=True
    ),
)


# ---------------------------------------------------------------------------
# KBCategory - Hierarchical categories with unlimited nesting
# ---------------------------------------------------------------------------
class KBCategory(db.Model):
    """A category for organizing knowledge base articles. Supports unlimited nesting."""
    __tablename__ = 'kb_categories'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    slug = db.Column(db.String(255), nullable=False, unique=True)
    parent_id = db.Column(db.Integer, db.ForeignKey('kb_categories.id'), nullable=True)
    position = db.Column(db.Integer, default=0)
    description = db.Column(db.Text, nullable=True)
    icon = db.Column(db.String(100), nullable=True)  # Lucide icon name

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Self-referential: children loaded eagerly for tree building
    children = db.relationship(
        'KBCategory',
        backref=db.backref('parent', remote_side='KBCategory.id'),
        cascade='all, delete-orphan',
        lazy='joined',
        order_by='KBCategory.position'
    )

    # Articles in this category
    articles = db.relationship('KBArticle', backref='category', lazy='dynamic')

    __table_args__ = (
        db.Index('ix_kb_categories_parent_id', 'parent_id'),
        db.Index('ix_kb_categories_slug', 'slug'),
    )

    def get_depth(self):
        """Count nesting depth (root = 1). Used for tree rendering."""
        depth = 1
        current = self.parent
        while current:
            depth += 1
            current = current.parent
        return depth

    def get_ancestor_path(self):
        """Return list of ancestor categories from root to self (for breadcrumbs)."""
        path = [self]
        current = self.parent
        while current:
            path.insert(0, current)
            current = current.parent
        return path

    def to_dict(self, include_children=True):
        """Convert to dictionary for JSON responses."""
        result = {
            'id': self.id,
            'name': self.name,
            'slug': self.slug,
            'parent_id': self.parent_id,
            'position': self.position,
            'description': self.description,
            'icon': self.icon,
            'article_count': self.articles.filter_by(is_template=False).count(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_children:
            result['children'] = [c.to_dict(include_children=True) for c in self.children]
        return result


# ---------------------------------------------------------------------------
# KBTag - Tags for cross-cutting article categorization
# ---------------------------------------------------------------------------
class KBTag(db.Model):
    """A reusable tag for cross-referencing knowledge base articles."""
    __tablename__ = 'kb_tags'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    color = db.Column(db.String(7), nullable=True)  # Hex color, e.g. "#FFAA00"
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.Index('ix_kb_tags_name', 'name'),
    )

    def to_dict(self, include_article_count=False):
        """Convert to dictionary for JSON responses."""
        result = {
            'id': self.id,
            'name': self.name,
            'color': self.color,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_article_count:
            result['article_count'] = (
                KBArticle.query
                .filter(KBArticle.tags.any(KBTag.id == self.id))
                .filter_by(is_template=False)
                .count()
            )
        return result


# ---------------------------------------------------------------------------
# KBArticle - Core article model
# ---------------------------------------------------------------------------
class KBArticle(db.Model):
    """
    A knowledge base article with rich-text content, status lifecycle,
    and support for sub-pages (1 level deep).
    """
    __tablename__ = 'kb_articles'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(500), nullable=False)
    slug = db.Column(db.String(500), nullable=False, unique=True)

    # TipTap editor content stored as JSON document
    content_json = db.Column(JSONB, nullable=True)

    # Plain-text extraction for simple search and previews
    content_text = db.Column(db.Text, nullable=True)

    # PostgreSQL full-text search vector (GIN-indexed)
    search_vector = db.Column(TSVECTOR, nullable=True)

    # Organization
    category_id = db.Column(db.Integer, db.ForeignKey('kb_categories.id'), nullable=True)
    parent_id = db.Column(db.Integer, db.ForeignKey('kb_articles.id'), nullable=True)
    position = db.Column(db.Integer, default=0)

    # Status lifecycle: draft, in_progress, published, needs_review, outdated
    status = db.Column(db.String(50), default='draft')

    # Metadata
    source_url = db.Column(db.String(1000), nullable=True)
    source_verified_at = db.Column(db.DateTime, nullable=True)

    # Template support: when is_template=True, this article is a reusable template
    is_template = db.Column(db.Boolean, default=False)
    template_name = db.Column(db.String(255), nullable=True)

    # Timestamps
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Many-to-many with KB tags
    tags = db.relationship('KBTag', secondary=kb_article_tags, backref='articles', lazy='joined')

    # Sub-pages: 1 level deep (enforced at API layer)
    sub_pages = db.relationship(
        'KBArticle',
        backref=db.backref('parent_article', remote_side='KBArticle.id'),
        lazy='dynamic',
        order_by='KBArticle.position'
    )

    # Revision history
    revisions = db.relationship(
        'KBArticleRevision', backref='article',
        cascade='all, delete-orphan',
        order_by='KBArticleRevision.revision_number.desc()'
    )

    # Outgoing wiki links (articles this one links TO)
    outgoing_links = db.relationship(
        'KBArticleLink',
        foreign_keys='KBArticleLink.source_id',
        backref='source_article',
        cascade='all, delete-orphan'
    )

    # Incoming wiki links (articles that link TO this one - backlinks)
    incoming_links = db.relationship(
        'KBArticleLink',
        foreign_keys='KBArticleLink.target_id',
        backref='target_article',
        cascade='all, delete-orphan'
    )

    __table_args__ = (
        db.Index('ix_kb_articles_slug', 'slug'),
        db.Index('ix_kb_articles_category_id', 'category_id'),
        db.Index('ix_kb_articles_parent_id', 'parent_id'),
        db.Index('ix_kb_articles_status', 'status'),
        db.Index('ix_kb_articles_is_template', 'is_template'),
        db.Index('ix_kb_articles_updated_at', 'updated_at'),
        db.Index('ix_kb_articles_search_vector', 'search_vector', postgresql_using='gin'),
    )

    def to_dict(self, include_content=True):
        """
        Convert to dictionary for JSON responses.

        Args:
            include_content: If False, omits content_json for list views
                           where only title/metadata are needed.
        """
        result = {
            'id': self.id,
            'title': self.title,
            'slug': self.slug,
            'category_id': self.category_id,
            'parent_id': self.parent_id,
            'position': self.position,
            'status': self.status,
            'source_url': self.source_url,
            'source_verified_at': self.source_verified_at.isoformat() if self.source_verified_at else None,
            'is_template': self.is_template,
            'template_name': self.template_name,
            'tags': [t.to_dict() for t in self.tags],
            'content_text': self.content_text,
            'sub_page_count': self.sub_pages.count() if self.parent_id is None else 0,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

        if include_content:
            result['content_json'] = self.content_json

        return result


# ---------------------------------------------------------------------------
# KBArticleLink - Tracks wiki-style [[internal links]] between articles
# ---------------------------------------------------------------------------
class KBArticleLink(db.Model):
    """
    Tracks directional links between articles, populated by parsing
    [[wiki links]] from TipTap JSON on every save. Enables fast
    backlink lookups without full content scanning.
    """
    __tablename__ = 'kb_article_links'

    id = db.Column(db.Integer, primary_key=True)
    source_id = db.Column(
        db.Integer,
        db.ForeignKey('kb_articles.id', ondelete='CASCADE'),
        nullable=False
    )
    target_id = db.Column(
        db.Integer,
        db.ForeignKey('kb_articles.id', ondelete='CASCADE'),
        nullable=False
    )

    __table_args__ = (
        db.UniqueConstraint('source_id', 'target_id', name='uq_kb_article_link'),
        db.Index('ix_kb_article_links_source', 'source_id'),
        db.Index('ix_kb_article_links_target', 'target_id'),
    )


# ---------------------------------------------------------------------------
# KBArticleRevision - Lightweight revision history (capped at 20 per article)
# ---------------------------------------------------------------------------
class KBArticleRevision(db.Model):
    """
    A snapshot of an article's content at a point in time.
    Created automatically on each content update. Capped at 20
    revisions per article (oldest pruned when limit exceeded).
    """
    __tablename__ = 'kb_article_revisions'

    id = db.Column(db.Integer, primary_key=True)
    article_id = db.Column(
        db.Integer,
        db.ForeignKey('kb_articles.id', ondelete='CASCADE'),
        nullable=False
    )
    revision_number = db.Column(db.Integer, nullable=False)
    title = db.Column(db.String(500), nullable=False)
    content_json = db.Column(JSONB, nullable=True)
    content_text = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.Index('ix_kb_revisions_article_id', 'article_id'),
        db.UniqueConstraint('article_id', 'revision_number', name='uq_kb_revision'),
    )

    def to_dict(self, include_content=False):
        """Convert to dictionary for JSON responses."""
        result = {
            'id': self.id,
            'article_id': self.article_id,
            'revision_number': self.revision_number,
            'title': self.title,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_content:
            result['content_json'] = self.content_json
            result['content_text'] = self.content_text
        return result


# ---------------------------------------------------------------------------
# KBBookmark - Favorited/bookmarked articles
# ---------------------------------------------------------------------------
class KBBookmark(db.Model):
    """A bookmarked/favorited article for quick access."""
    __tablename__ = 'kb_bookmarks'

    id = db.Column(db.Integer, primary_key=True)
    article_id = db.Column(
        db.Integer,
        db.ForeignKey('kb_articles.id', ondelete='CASCADE'),
        nullable=False
    )
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    article = db.relationship('KBArticle', backref='bookmarks')

    __table_args__ = (
        db.UniqueConstraint('article_id', name='uq_kb_bookmark_article'),
        db.Index('ix_kb_bookmarks_article_id', 'article_id'),
    )


# ---------------------------------------------------------------------------
# KBRecentView - Recently viewed article tracking
# ---------------------------------------------------------------------------
class KBRecentView(db.Model):
    """Tracks recently viewed articles. Pruned to last 50 entries."""
    __tablename__ = 'kb_recent_views'

    id = db.Column(db.Integer, primary_key=True)
    article_id = db.Column(
        db.Integer,
        db.ForeignKey('kb_articles.id', ondelete='CASCADE'),
        nullable=False
    )
    viewed_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    article = db.relationship('KBArticle', backref='views')

    __table_args__ = (
        db.Index('ix_kb_recent_views_article_id', 'article_id'),
        db.Index('ix_kb_recent_views_viewed_at', 'viewed_at'),
    )
