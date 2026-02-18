"""
Knowledge Base Module - API Routes

Wiki-style knowledge management system with hierarchical categories,
rich-text articles, tagging, wiki-style internal linking, full-text
search, revision history, and article templates.

Endpoints (Phase 1 - Core CRUD):
    GET    /api/kb/categories              → Full category tree (nested)
    POST   /api/kb/categories              → Create category
    PUT    /api/kb/categories/<id>         → Update category
    DELETE /api/kb/categories/<id>         → Delete category
    PUT    /api/kb/categories/reorder      → Reorder categories within parent

    GET    /api/kb/articles                → List articles (with filters)
    POST   /api/kb/articles                → Create article
    GET    /api/kb/stats                   → Stats for dashboard
    GET    /api/kb/articles/<slug>         → Get single article (full content)
    PUT    /api/kb/articles/<slug>         → Update article (partial)
    DELETE /api/kb/articles/<slug>         → Delete article
"""
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from app import db
from app.models.kb import (
    KBCategory, KBArticle, KBTag, kb_article_tags,
    KBArticleLink, KBArticleRevision, KBBookmark, KBRecentView
)
from app.utils import (
    extract_text_from_tiptap, generate_kb_slug, generate_kb_category_slug,
    update_article_links, update_search_vector, tiptap_to_markdown, markdown_to_tiptap
)

kb_bp = Blueprint('kb', __name__)


# ── Categories CRUD ────────────────────────────────────────────────


@kb_bp.route('/categories', methods=['GET'])
def list_categories():
    """
    Get the full category tree (nested).

    Returns only root-level categories with children eagerly loaded
    via the self-referential relationship.
    """
    roots = (
        KBCategory.query
        .filter(KBCategory.parent_id.is_(None))
        .order_by(KBCategory.position)
        .all()
    )
    return jsonify([c.to_dict(include_children=True) for c in roots])


@kb_bp.route('/categories', methods=['POST'])
def create_category():
    """
    Create a new category.

    Expects JSON:
    {
        "name": "Networking",
        "parent_id": null,      // optional - null for root level
        "description": "...",   // optional
        "icon": "network"       // optional - lucide icon name
    }
    """
    data = request.get_json()
    name = data.get('name', '').strip()

    if not name:
        return jsonify({'error': 'Category name is required'}), 400

    slug = generate_kb_category_slug(name)

    # Determine position: append after existing siblings
    parent_id = data.get('parent_id')
    max_pos = db.session.query(db.func.max(KBCategory.position)).filter(
        KBCategory.parent_id == parent_id if parent_id else KBCategory.parent_id.is_(None)
    ).scalar() or 0

    category = KBCategory(
        name=name,
        slug=slug,
        parent_id=parent_id,
        position=max_pos + 1,
        description=data.get('description'),
        icon=data.get('icon'),
    )

    db.session.add(category)
    db.session.commit()

    # Emit notification event
    try:
        from app.services.event_bus import emit
        emit('kb.category_created', name=category.name)
    except Exception:
        pass

    return jsonify(category.to_dict(include_children=True)), 201


# Static route MUST come before parameterized /<id> route
@kb_bp.route('/categories/reorder', methods=['PUT'])
def reorder_categories():
    """
    Reorder categories within a parent.

    Expects JSON:
    {
        "parent_id": null,   // or category ID
        "ids": [3, 1, 5, 2] // ordered list of category IDs
    }
    """
    data = request.get_json()
    ids = data.get('ids', [])

    for position, cat_id in enumerate(ids):
        category = KBCategory.query.get(cat_id)
        if category:
            category.position = position
            category.parent_id = data.get('parent_id')

    db.session.commit()
    return jsonify({'message': 'Categories reordered'})


@kb_bp.route('/categories/<int:category_id>', methods=['PUT'])
def update_category(category_id):
    """
    Update a category. Supports partial updates.

    Updatable fields: name, parent_id, description, icon
    """
    category = KBCategory.query.get_or_404(category_id)
    data = request.get_json()

    if 'name' in data:
        name = data['name'].strip()
        if not name:
            return jsonify({'error': 'Category name is required'}), 400
        # Regenerate slug if name changes
        if name != category.name:
            category.name = name
            category.slug = generate_kb_category_slug(name)

    if 'parent_id' in data:
        new_parent = data['parent_id']
        # Prevent setting self as parent
        if new_parent == category.id:
            return jsonify({'error': 'Category cannot be its own parent'}), 400
        category.parent_id = new_parent

    if 'description' in data:
        category.description = data['description']

    if 'icon' in data:
        category.icon = data['icon']

    db.session.commit()
    return jsonify(category.to_dict(include_children=True))


@kb_bp.route('/categories/<int:category_id>', methods=['DELETE'])
def delete_category(category_id):
    """
    Delete a category.

    Articles in the deleted category are moved to root (category_id=None).
    Child categories are also deleted (cascade).
    """
    category = KBCategory.query.get_or_404(category_id)

    # Move articles in this category (and child categories) to root
    _move_category_articles_to_root(category)

    db.session.delete(category)
    db.session.commit()
    return jsonify({'message': 'Category deleted'}), 200


def _move_category_articles_to_root(category):
    """Recursively move all articles in a category tree to root level."""
    # Move articles in this category
    for article in category.articles.all():
        article.category_id = None

    # Recurse into children
    for child in category.children:
        _move_category_articles_to_root(child)


# ── Articles CRUD ──────────────────────────────────────────────────


@kb_bp.route('/articles', methods=['GET'])
def list_articles():
    """
    List articles with optional filtering, sorting, and pagination.

    Query parameters:
        ?category_id=3       → Articles in a specific category
        ?status=published    → Filter by status
        ?is_template=true    → Only templates
        ?search=keyword      → Search title and content_text (ILIKE)
        ?sort=updated_at     → Sort field (updated_at, created_at, title)
        ?order=desc          → Sort order (asc, desc)
        ?page=1              → Page number (default 1)
        ?per_page=30         → Results per page (default 30, max 100; 0=all)
    """
    query = KBArticle.query

    # Filter: exclude templates by default
    if request.args.get('is_template') == 'true':
        query = query.filter(KBArticle.is_template == True)  # noqa: E712
    else:
        query = query.filter(KBArticle.is_template == False)  # noqa: E712

    # Filter by category
    category_id = request.args.get('category_id')
    if category_id is not None:
        if category_id == 'null' or category_id == '':
            query = query.filter(KBArticle.category_id.is_(None))
        else:
            query = query.filter(KBArticle.category_id == int(category_id))

    # Filter by status
    status = request.args.get('status')
    if status:
        query = query.filter(KBArticle.status == status)

    # Filter by parent (sub-pages)
    parent_id = request.args.get('parent_id')
    if parent_id is not None:
        if parent_id == 'null' or parent_id == '':
            query = query.filter(KBArticle.parent_id.is_(None))
        else:
            query = query.filter(KBArticle.parent_id == int(parent_id))
    else:
        # By default, only show top-level articles (not sub-pages)
        query = query.filter(KBArticle.parent_id.is_(None))

    # Filter by tag
    tag_id = request.args.get('tag_id')
    if tag_id:
        query = query.filter(KBArticle.tags.any(KBTag.id == int(tag_id)))

    # Simple search (ILIKE for now; full-text search in Phase 4)
    search = request.args.get('search')
    if search:
        search_term = f'%{search}%'
        query = query.filter(
            db.or_(
                KBArticle.title.ilike(search_term),
                KBArticle.content_text.ilike(search_term),
            )
        )

    # Sorting
    sort_field = request.args.get('sort', 'updated_at')
    sort_order = request.args.get('order', 'desc')

    sort_column = {
        'updated_at': KBArticle.updated_at,
        'created_at': KBArticle.created_at,
        'title': KBArticle.title,
        'position': KBArticle.position,
    }.get(sort_field, KBArticle.updated_at)

    if sort_order == 'asc':
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    # Pagination (per_page=0 returns all, for backwards compatibility)
    per_page = int(request.args.get('per_page', 30))
    page = max(1, int(request.args.get('page', 1)))

    if per_page <= 0:
        # No pagination — return all
        articles = query.all()
        return jsonify({
            'articles': [a.to_dict(include_content=False) for a in articles],
            'total': len(articles),
            'page': 1,
            'per_page': 0,
            'total_pages': 1,
        })

    per_page = min(per_page, 100)
    total = query.count()
    total_pages = max(1, (total + per_page - 1) // per_page)

    articles = query.offset((page - 1) * per_page).limit(per_page).all()

    return jsonify({
        'articles': [a.to_dict(include_content=False) for a in articles],
        'total': total,
        'page': page,
        'per_page': per_page,
        'total_pages': total_pages,
    })


@kb_bp.route('/articles', methods=['POST'])
def create_article():
    """
    Create a new article.

    Expects JSON:
    {
        "title": "My Article",
        "content_json": { ... TipTap JSON ... },  // optional
        "category_id": 1,                         // optional
        "status": "draft",                         // optional, default: draft
        "source_url": "https://...",               // optional
        "tag_ids": [1, 2, 3],                     // optional
        "is_template": false,                      // optional
        "template_name": "How-To Guide"            // optional, only for templates
    }
    """
    data = request.get_json()
    title = data.get('title', '').strip()

    if not title:
        return jsonify({'error': 'Article title is required'}), 400

    slug = generate_kb_slug(title)
    content_json = data.get('content_json')
    content_text = extract_text_from_tiptap(content_json)

    # Enforce 1-level sub-page depth
    parent_id = data.get('parent_id')
    if parent_id:
        parent = KBArticle.query.get(parent_id)
        if parent and parent.parent_id is not None:
            return jsonify({'error': 'Sub-pages cannot have sub-pages (1-level max)'}), 400

    article = KBArticle(
        title=title,
        slug=slug,
        content_json=content_json,
        content_text=content_text,
        category_id=data.get('category_id'),
        parent_id=parent_id,
        status=data.get('status', 'draft'),
        source_url=data.get('source_url'),
        is_template=data.get('is_template', False),
        template_name=data.get('template_name'),
    )

    # Attach tags by ID
    tag_ids = data.get('tag_ids', [])
    if tag_ids:
        tags = KBTag.query.filter(KBTag.id.in_(tag_ids)).all()
        article.tags = tags

    db.session.add(article)
    db.session.commit()

    # Update search vector and wiki links (requires article.id from commit)
    update_search_vector(article, db.session)
    if content_json:
        update_article_links(article, db.session)
    db.session.commit()

    # Emit notification event
    try:
        from app.services.event_bus import emit
        emit('kb.article_created', title=article.title, status=article.status)
    except Exception:
        pass

    return jsonify(article.to_dict()), 201


# Static routes MUST come before /<slug> to prevent slug matching "stats"
@kb_bp.route('/stats', methods=['GET'])
def kb_stats():
    """
    Stats for the dashboard.

    Returns:
    {
        "total": 42,
        "by_status": { "draft": 5, "published": 30, ... },
        "categories_count": 8,
        "recent": [ ... top 5 recently updated articles ... ]
    }
    """
    total = KBArticle.query.filter_by(is_template=False).count()
    templates_count = KBArticle.query.filter_by(is_template=True).count()
    categories_count = KBCategory.query.count()

    # Count by status (excluding templates)
    by_status = {}
    for status in ['draft', 'in_progress', 'published', 'needs_review', 'outdated']:
        by_status[status] = KBArticle.query.filter_by(
            status=status, is_template=False
        ).count()

    recent = (
        KBArticle.query
        .filter_by(is_template=False)
        .order_by(KBArticle.updated_at.desc())
        .limit(5)
        .all()
    )

    return jsonify({
        'total': total,
        'templates_count': templates_count,
        'categories_count': categories_count,
        'by_status': by_status,
        'recent': [a.to_dict(include_content=False) for a in recent],
    })


@kb_bp.route('/articles/<slug>', methods=['GET'])
def get_article(slug):
    """Get a single article with full content."""
    article = KBArticle.query.filter_by(slug=slug).first()
    if not article:
        return jsonify({'error': 'Article not found'}), 404

    result = article.to_dict(include_content=True)

    # Include category breadcrumb path if article is in a category
    if article.category:
        ancestors = article.category.get_ancestor_path()
        result['breadcrumb'] = [
            {'id': c.id, 'name': c.name, 'slug': c.slug}
            for c in ancestors
        ]
    else:
        result['breadcrumb'] = []

    # Include parent article info for sub-pages
    if article.parent_id and article.parent_article:
        result['parent_article'] = {
            'id': article.parent_article.id,
            'title': article.parent_article.title,
            'slug': article.parent_article.slug,
        }
    else:
        result['parent_article'] = None

    return jsonify(result)


@kb_bp.route('/articles/<slug>', methods=['PUT'])
def update_article(slug):
    """
    Update an article. Supports partial updates (auto-save target).

    Only fields present in the request body are updated.
    When content_json is updated, content_text is automatically
    recalculated for search indexing.
    """
    article = KBArticle.query.filter_by(slug=slug).first()
    if not article:
        return jsonify({'error': 'Article not found'}), 404

    data = request.get_json()

    if 'title' in data:
        title = data['title'].strip()
        if not title:
            return jsonify({'error': 'Article title is required'}), 400
        # Regenerate slug if title changes
        if title != article.title:
            article.title = title
            article.slug = generate_kb_slug(title)

    if 'content_json' in data:
        # Create a revision snapshot before overwriting content
        _create_revision(article)
        article.content_json = data['content_json']
        article.content_text = extract_text_from_tiptap(data['content_json'])
        # Update wiki link references
        update_article_links(article, db.session)

    if 'category_id' in data:
        article.category_id = data['category_id']

    if 'status' in data:
        valid_statuses = ['draft', 'in_progress', 'published', 'needs_review', 'outdated']
        if data['status'] in valid_statuses:
            article.status = data['status']
        else:
            return jsonify({'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'}), 400

    if 'source_url' in data:
        article.source_url = data['source_url']

    if 'source_verified_at' in data:
        if data['source_verified_at']:
            try:
                article.source_verified_at = datetime.fromisoformat(data['source_verified_at'])
            except (ValueError, TypeError):
                return jsonify({'error': 'Invalid date format for source_verified_at'}), 400
        else:
            article.source_verified_at = None

    if 'tag_ids' in data:
        tags = KBTag.query.filter(KBTag.id.in_(data['tag_ids'])).all()
        article.tags = tags

    if 'parent_id' in data:
        new_parent_id = data['parent_id']
        if new_parent_id:
            # Enforce 1-level depth
            parent = KBArticle.query.get(new_parent_id)
            if parent and parent.parent_id is not None:
                return jsonify({'error': 'Sub-pages cannot have sub-pages (1-level max)'}), 400
            if article.sub_pages.count() > 0:
                return jsonify({'error': 'This article has sub-pages and cannot become a sub-page itself'}), 400
        article.parent_id = new_parent_id

    if 'position' in data:
        article.position = data['position']

    db.session.commit()

    # Update search vector if title or content changed
    if 'title' in data or 'content_json' in data:
        update_search_vector(article, db.session)
        db.session.commit()

    # Emit notification event
    try:
        from app.services.event_bus import emit
        emit('kb.article_updated', title=article.title, slug=article.slug)
    except Exception:
        pass

    return jsonify(article.to_dict())


@kb_bp.route('/articles/<slug>', methods=['DELETE'])
def delete_article(slug):
    """
    Permanently delete an article.

    Also deletes all sub-pages, revisions, bookmarks, and link references.
    """
    article = KBArticle.query.filter_by(slug=slug).first()
    if not article:
        return jsonify({'error': 'Article not found'}), 404

    title = article.title

    db.session.delete(article)
    db.session.commit()

    # Emit notification event
    try:
        from app.services.event_bus import emit
        emit('kb.article_deleted', title=title)
    except Exception:
        pass

    return jsonify({'message': 'Article deleted'}), 200


# ── Revision History ──────────────────────────────────────────


def _create_revision(article):
    """
    Create a revision snapshot of the article's current state.
    Caps at 20 revisions per article — deletes the oldest when exceeded.
    Called automatically before content_json is overwritten.
    """
    if not article.content_json:
        return  # Nothing to snapshot

    # Get next revision number
    max_rev = db.session.query(
        db.func.max(KBArticleRevision.revision_number)
    ).filter_by(article_id=article.id).scalar() or 0

    revision = KBArticleRevision(
        article_id=article.id,
        revision_number=max_rev + 1,
        title=article.title,
        content_json=article.content_json,
        content_text=article.content_text,
    )
    db.session.add(revision)
    db.session.flush()

    # Prune: keep only the 20 most recent revisions
    revisions = (
        KBArticleRevision.query
        .filter_by(article_id=article.id)
        .order_by(KBArticleRevision.revision_number.desc())
        .all()
    )
    if len(revisions) > 20:
        for old in revisions[20:]:
            db.session.delete(old)


@kb_bp.route('/articles/<slug>/revisions', methods=['GET'])
def list_revisions(slug):
    """
    List all revisions for an article, newest first.
    Returns metadata only (no content) for the list view.
    """
    article = KBArticle.query.filter_by(slug=slug).first()
    if not article:
        return jsonify({'error': 'Article not found'}), 404

    revisions = (
        KBArticleRevision.query
        .filter_by(article_id=article.id)
        .order_by(KBArticleRevision.revision_number.desc())
        .all()
    )
    return jsonify([r.to_dict(include_content=False) for r in revisions])


@kb_bp.route('/articles/<slug>/revisions/<int:revision_id>', methods=['GET'])
def get_revision(slug, revision_id):
    """Get a single revision with full content."""
    article = KBArticle.query.filter_by(slug=slug).first()
    if not article:
        return jsonify({'error': 'Article not found'}), 404

    revision = KBArticleRevision.query.filter_by(
        article_id=article.id, id=revision_id
    ).first()
    if not revision:
        return jsonify({'error': 'Revision not found'}), 404

    return jsonify(revision.to_dict(include_content=True))


@kb_bp.route('/articles/<slug>/revisions/<int:revision_id>/restore', methods=['POST'])
def restore_revision(slug, revision_id):
    """
    Restore an article to a previous revision.
    Creates a new revision snapshot of the current state before restoring.
    """
    article = KBArticle.query.filter_by(slug=slug).first()
    if not article:
        return jsonify({'error': 'Article not found'}), 404

    revision = KBArticleRevision.query.filter_by(
        article_id=article.id, id=revision_id
    ).first()
    if not revision:
        return jsonify({'error': 'Revision not found'}), 404

    # Snapshot current state before overwriting
    _create_revision(article)

    # Restore from the selected revision
    article.title = revision.title
    article.content_json = revision.content_json
    article.content_text = revision.content_text

    db.session.commit()
    return jsonify(article.to_dict(include_content=True))


# ── Templates ─────────────────────────────────────────────────


@kb_bp.route('/templates', methods=['GET'])
def list_templates():
    """List all article templates."""
    templates = (
        KBArticle.query
        .filter_by(is_template=True)
        .order_by(KBArticle.title)
        .all()
    )
    return jsonify([t.to_dict(include_content=False) for t in templates])


@kb_bp.route('/articles/<slug>/save-template', methods=['POST'])
def save_as_template(slug):
    """
    Save a copy of an article as a reusable template.

    Expects JSON:
    {
        "template_name": "How-To Guide"  // optional, defaults to article title
    }
    """
    article = KBArticle.query.filter_by(slug=slug).first()
    if not article:
        return jsonify({'error': 'Article not found'}), 404

    data = request.get_json() or {}
    template_name = data.get('template_name', article.title).strip()

    template = KBArticle(
        title=f"[Template] {template_name}",
        slug=generate_kb_slug(f"template-{template_name}"),
        content_json=article.content_json,
        content_text=article.content_text,
        is_template=True,
        template_name=template_name,
        status='published',
    )

    db.session.add(template)
    db.session.commit()

    return jsonify(template.to_dict()), 201


@kb_bp.route('/articles/from-template', methods=['POST'])
def create_from_template():
    """
    Create a new article pre-filled from a template.

    Expects JSON:
    {
        "template_id": 42,
        "title": "My New Article",     // optional, defaults to template name
        "category_id": 1               // optional
    }
    """
    data = request.get_json()
    template_id = data.get('template_id')

    if not template_id:
        return jsonify({'error': 'template_id is required'}), 400

    template = KBArticle.query.filter_by(id=template_id, is_template=True).first()
    if not template:
        return jsonify({'error': 'Template not found'}), 404

    title = data.get('title', template.template_name or template.title).strip()
    # Remove [Template] prefix if it was inherited
    if title.startswith('[Template] '):
        title = title[len('[Template] '):]

    article = KBArticle(
        title=title,
        slug=generate_kb_slug(title),
        content_json=template.content_json,
        content_text=template.content_text,
        category_id=data.get('category_id'),
        status='draft',
    )

    db.session.add(article)
    db.session.commit()

    return jsonify(article.to_dict()), 201


# ── Tags CRUD ─────────────────────────────────────────────────


@kb_bp.route('/tags', methods=['GET'])
def list_tags():
    """
    List all tags with article counts.
    """
    tags = KBTag.query.order_by(KBTag.name).all()
    return jsonify([t.to_dict(include_article_count=True) for t in tags])


@kb_bp.route('/tags', methods=['POST'])
def create_tag():
    """
    Create a new tag.

    Expects JSON:
    {
        "name": "networking",
        "color": "#FFAA00"   // optional hex color
    }
    """
    data = request.get_json()
    name = data.get('name', '').strip()

    if not name:
        return jsonify({'error': 'Tag name is required'}), 400

    # Check for duplicate
    existing = KBTag.query.filter(
        db.func.lower(KBTag.name) == name.lower()
    ).first()
    if existing:
        return jsonify({'error': 'Tag already exists'}), 409

    tag = KBTag(
        name=name,
        color=data.get('color'),
    )
    db.session.add(tag)
    db.session.commit()

    return jsonify(tag.to_dict(include_article_count=True)), 201


@kb_bp.route('/tags/<int:tag_id>', methods=['PUT'])
def update_tag(tag_id):
    """Update a tag's name or color."""
    tag = KBTag.query.get_or_404(tag_id)
    data = request.get_json()

    if 'name' in data:
        name = data['name'].strip()
        if not name:
            return jsonify({'error': 'Tag name is required'}), 400
        # Check for duplicate (excluding self)
        existing = KBTag.query.filter(
            db.func.lower(KBTag.name) == name.lower(),
            KBTag.id != tag_id
        ).first()
        if existing:
            return jsonify({'error': 'Tag name already in use'}), 409
        tag.name = name

    if 'color' in data:
        tag.color = data['color']

    db.session.commit()
    return jsonify(tag.to_dict(include_article_count=True))


@kb_bp.route('/tags/<int:tag_id>', methods=['DELETE'])
def delete_tag(tag_id):
    """Delete a tag. Removes it from all articles."""
    tag = KBTag.query.get_or_404(tag_id)
    db.session.delete(tag)
    db.session.commit()
    return jsonify({'message': 'Tag deleted'}), 200


# ── Backlinks ──────────────────────────────────────────────────


@kb_bp.route('/articles/<slug>/backlinks', methods=['GET'])
def get_backlinks(slug):
    """
    Get articles that link TO this article via wiki links.

    Returns a list of article summaries (no content) that contain
    [[wiki links]] pointing to the requested article.
    """
    article = KBArticle.query.filter_by(slug=slug).first()
    if not article:
        return jsonify({'error': 'Article not found'}), 404

    # Find all articles that link to this one
    backlinks = (
        KBArticle.query
        .join(KBArticleLink, KBArticleLink.source_id == KBArticle.id)
        .filter(KBArticleLink.target_id == article.id)
        .filter(KBArticle.is_template == False)  # noqa: E712
        .order_by(KBArticle.title)
        .all()
    )

    return jsonify([a.to_dict(include_content=False) for a in backlinks])


# ── Full-Text Search ──────────────────────────────────────────


@kb_bp.route('/search', methods=['GET'])
def search_articles():
    """
    Full-text search across KB articles using PostgreSQL tsvector.

    Query parameters:
        ?q=keyword           → Search query (required)
        ?category_id=3       → Filter by category
        ?status=published    → Filter by status
        ?tag_id=5            → Filter by tag
        ?page=1              → Page number (default 1)
        ?per_page=20         → Results per page (default 20, max 100)

    Returns results ranked by relevance with highlighted snippets.
    Falls back to ILIKE search if search_vector is not populated.
    """
    from sqlalchemy import text, func

    q = request.args.get('q', '').strip()
    if not q:
        return jsonify({'results': [], 'total': 0, 'page': 1, 'per_page': 20})

    page = max(1, int(request.args.get('page', 1)))
    per_page = min(100, max(1, int(request.args.get('per_page', 20))))

    # Build the tsquery from the search terms
    ts_query = func.plainto_tsquery('english', q)

    # Base query: search using tsvector with rank
    query = (
        db.session.query(
            KBArticle,
            func.ts_rank(KBArticle.search_vector, ts_query).label('rank'),
            func.ts_headline(
                'english',
                func.coalesce(KBArticle.content_text, ''),
                ts_query,
                'StartSel=<<, StopSel=>>, MaxWords=40, MinWords=20, MaxFragments=2'
            ).label('headline')
        )
        .filter(KBArticle.search_vector.op('@@')(ts_query))
        .filter(KBArticle.is_template == False)  # noqa: E712
    )

    # Apply filters
    category_id = request.args.get('category_id')
    if category_id:
        query = query.filter(KBArticle.category_id == int(category_id))

    status = request.args.get('status')
    if status:
        query = query.filter(KBArticle.status == status)

    tag_id = request.args.get('tag_id')
    if tag_id:
        query = query.filter(KBArticle.tags.any(KBTag.id == int(tag_id)))

    # Get total count before pagination
    total = query.count()

    # Order by relevance and paginate
    results = (
        query
        .order_by(text('rank DESC'))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return jsonify({
        'results': [
            {
                **article.to_dict(include_content=False),
                'rank': float(rank),
                'headline': headline,
            }
            for article, rank, headline in results
        ],
        'total': total,
        'page': page,
        'per_page': per_page,
    })


# ── Recently Viewed ──────────────────────────────────────────


@kb_bp.route('/articles/<slug>/view', methods=['POST'])
def record_view(slug):
    """
    Record that an article was viewed. Used for "recently viewed" list.
    Upserts: if already viewed, updates the timestamp.
    Prunes to the last 50 entries.
    """
    article = KBArticle.query.filter_by(slug=slug).first()
    if not article:
        return jsonify({'error': 'Article not found'}), 404

    # Check for existing view
    existing = KBRecentView.query.filter_by(article_id=article.id).first()
    if existing:
        existing.viewed_at = datetime.now(timezone.utc)
    else:
        view = KBRecentView(article_id=article.id)
        db.session.add(view)

    db.session.commit()

    # Prune: keep only the 50 most recent
    views = (
        KBRecentView.query
        .order_by(KBRecentView.viewed_at.desc())
        .all()
    )
    if len(views) > 50:
        for old in views[50:]:
            db.session.delete(old)
        db.session.commit()

    return jsonify({'message': 'View recorded'})


@kb_bp.route('/recent-views', methods=['GET'])
def list_recent_views():
    """
    Get recently viewed articles, newest first.

    Query parameters:
        ?limit=20   → Number of results (default 20, max 50)
    """
    limit = min(50, max(1, int(request.args.get('limit', 20))))

    views = (
        KBRecentView.query
        .order_by(KBRecentView.viewed_at.desc())
        .limit(limit)
        .all()
    )

    results = []
    for v in views:
        if v.article:
            item = v.article.to_dict(include_content=False)
            item['viewed_at'] = v.viewed_at.isoformat() if v.viewed_at else None
            results.append(item)

    return jsonify(results)


# ── Bookmarks ──────────────────────────────────────────────────


@kb_bp.route('/articles/<slug>/bookmark', methods=['POST'])
def toggle_bookmark(slug):
    """
    Toggle bookmark on an article. If bookmarked, removes it.
    If not bookmarked, adds it.

    Returns: { "bookmarked": true/false }
    """
    article = KBArticle.query.filter_by(slug=slug).first()
    if not article:
        return jsonify({'error': 'Article not found'}), 404

    existing = KBBookmark.query.filter_by(article_id=article.id).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({'bookmarked': False})
    else:
        bookmark = KBBookmark(article_id=article.id)
        db.session.add(bookmark)
        db.session.commit()
        return jsonify({'bookmarked': True})


@kb_bp.route('/bookmarks', methods=['GET'])
def list_bookmarks():
    """
    Get all bookmarked articles, newest first.
    """
    bookmarks = (
        KBBookmark.query
        .order_by(KBBookmark.created_at.desc())
        .all()
    )

    results = []
    for b in bookmarks:
        if b.article:
            item = b.article.to_dict(include_content=False)
            item['bookmarked_at'] = b.created_at.isoformat() if b.created_at else None
            results.append(item)

    return jsonify(results)


# ── Export / Import ──────────────────────────────────────────────


@kb_bp.route('/articles/<slug>/export', methods=['GET'])
def export_article(slug):
    """
    Export an article as Markdown with YAML frontmatter.

    Returns a Markdown file with metadata in YAML front matter
    (title, status, category, tags, dates, source_url).
    """
    from flask import Response
    import yaml

    article = KBArticle.query.filter_by(slug=slug).first()
    if not article:
        return jsonify({'error': 'Article not found'}), 404

    # Build YAML frontmatter
    frontmatter = {
        'title': article.title,
        'status': article.status,
        'slug': article.slug,
        'created_at': article.created_at.isoformat() if article.created_at else None,
        'updated_at': article.updated_at.isoformat() if article.updated_at else None,
    }

    if article.category:
        frontmatter['category'] = article.category.name

    if article.tags:
        frontmatter['tags'] = [t.name for t in article.tags]

    if article.source_url:
        frontmatter['source_url'] = article.source_url

    # Convert content
    md_body = tiptap_to_markdown(article.content_json)

    # Assemble final document
    yaml_str = yaml.dump(frontmatter, default_flow_style=False, allow_unicode=True)
    markdown = f'---\n{yaml_str}---\n\n{md_body}\n'

    filename = f'{article.slug}.md'
    return Response(
        markdown,
        mimetype='text/markdown',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"',
        },
    )


@kb_bp.route('/import', methods=['POST'])
def import_article():
    """
    Import a Markdown file as a new KB article.

    Accepts a multipart file upload with optional YAML frontmatter.
    Frontmatter fields: title, status, category, tags, source_url.

    If no title is found in frontmatter, uses the filename (without extension).
    """
    import yaml

    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'No filename'}), 400

    md_text = file.read().decode('utf-8')

    # Parse YAML frontmatter if present
    frontmatter = {}
    body = md_text
    if md_text.startswith('---'):
        parts = md_text.split('---', 2)
        if len(parts) >= 3:
            try:
                frontmatter = yaml.safe_load(parts[1]) or {}
            except yaml.YAMLError:
                pass
            body = parts[2].strip()

    # Determine title
    title = frontmatter.get('title', '').strip()
    if not title:
        # Use filename without extension
        import os
        title = os.path.splitext(file.filename)[0].replace('-', ' ').replace('_', ' ').title()

    # Convert body to TipTap JSON
    content_json = markdown_to_tiptap(body)
    content_text = extract_text_from_tiptap(content_json)

    # Resolve category by name
    category_id = None
    category_name = frontmatter.get('category', '').strip()
    if category_name:
        cat = KBCategory.query.filter(
            db.func.lower(KBCategory.name) == category_name.lower()
        ).first()
        if cat:
            category_id = cat.id

    # Create article
    slug = generate_kb_slug(title)
    article = KBArticle(
        title=title,
        slug=slug,
        content_json=content_json,
        content_text=content_text,
        category_id=category_id,
        status=frontmatter.get('status', 'draft'),
        source_url=frontmatter.get('source_url'),
    )

    # Resolve and attach tags by name
    tag_names = frontmatter.get('tags', [])
    if tag_names and isinstance(tag_names, list):
        for name in tag_names:
            name = str(name).strip()
            if not name:
                continue
            tag = KBTag.query.filter(
                db.func.lower(KBTag.name) == name.lower()
            ).first()
            if not tag:
                tag = KBTag(name=name)
                db.session.add(tag)
                db.session.flush()
            article.tags.append(tag)

    db.session.add(article)
    db.session.commit()

    # Update search vector and links
    update_search_vector(article, db.session)
    if content_json:
        update_article_links(article, db.session)
    db.session.commit()

    return jsonify(article.to_dict()), 201


# ── Sub-Pages ────────────────────────────────────────────────────


@kb_bp.route('/articles/<slug>/sub-pages', methods=['GET'])
def list_sub_pages(slug):
    """
    List sub-pages of an article, ordered by position.
    """
    article = KBArticle.query.filter_by(slug=slug).first()
    if not article:
        return jsonify({'error': 'Article not found'}), 404

    sub_pages = (
        KBArticle.query
        .filter_by(parent_id=article.id, is_template=False)
        .order_by(KBArticle.position)
        .all()
    )
    return jsonify([sp.to_dict(include_content=False) for sp in sub_pages])


@kb_bp.route('/articles/<slug>/parent', methods=['PUT'])
def set_parent(slug):
    """
    Set or clear the parent of an article (make it a sub-page or top-level).

    Expects JSON:
    {
        "parent_slug": "parent-article-slug"  // or null to clear
    }

    Enforces 1-level max: a sub-page cannot itself have sub-pages.
    """
    article = KBArticle.query.filter_by(slug=slug).first()
    if not article:
        return jsonify({'error': 'Article not found'}), 404

    data = request.get_json()
    parent_slug = data.get('parent_slug')

    if parent_slug is None:
        # Clear parent — make top-level
        article.parent_id = None
        db.session.commit()
        return jsonify(article.to_dict())

    # Look up parent
    parent = KBArticle.query.filter_by(slug=parent_slug).first()
    if not parent:
        return jsonify({'error': 'Parent article not found'}), 404

    # Enforce: can't set self as parent
    if parent.id == article.id:
        return jsonify({'error': 'Article cannot be its own parent'}), 400

    # Enforce: parent can't itself be a sub-page (1-level max)
    if parent.parent_id is not None:
        return jsonify({'error': 'Sub-pages cannot have sub-pages (1-level max)'}), 400

    # Enforce: this article has sub-pages, can't become a sub-page
    if article.sub_pages.count() > 0:
        return jsonify({'error': 'This article has sub-pages and cannot become a sub-page itself'}), 400

    article.parent_id = parent.id
    db.session.commit()

    return jsonify(article.to_dict())
