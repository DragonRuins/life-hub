"""
Utility functions shared across the Datacore application.
"""
import re
from urllib.parse import urlparse


def generate_slug(name):
    """
    Generate a URL-safe slug from a project name.

    Lowercases the input, replaces non-alphanumeric characters with hyphens,
    and collapses consecutive hyphens. If the resulting slug already exists
    in the database, appends a numeric suffix (-2, -3, ...).

    Args:
        name: The project name to slugify.

    Returns:
        A unique slug string safe for use in URLs.
    """
    # Lowercase, replace non-alphanumeric with hyphens, collapse multiples
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    if not slug:
        slug = 'project'

    # Check for uniqueness in the database
    from app.models.project import Project
    if not Project.query.filter_by(slug=slug).first():
        return slug

    # Append numeric suffix until unique
    counter = 2
    while Project.query.filter_by(slug=f'{slug}-{counter}').first():
        counter += 1
    return f'{slug}-{counter}'


def generate_kb_slug(title):
    """
    Generate a URL-safe slug from a knowledge base article or category title.

    Same logic as generate_slug() but checks against the KBArticle table
    for uniqueness.

    Args:
        title: The article/category title to slugify.

    Returns:
        A unique slug string safe for use in URLs.
    """
    slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
    if not slug:
        slug = 'article'

    from app.models.kb import KBArticle
    if not KBArticle.query.filter_by(slug=slug).first():
        return slug

    counter = 2
    while KBArticle.query.filter_by(slug=f'{slug}-{counter}').first():
        counter += 1
    return f'{slug}-{counter}'


def generate_kb_category_slug(name):
    """
    Generate a URL-safe slug from a knowledge base category name.

    Args:
        name: The category name to slugify.

    Returns:
        A unique slug string safe for use in URLs.
    """
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    if not slug:
        slug = 'category'

    from app.models.kb import KBCategory
    if not KBCategory.query.filter_by(slug=slug).first():
        return slug

    counter = 2
    while KBCategory.query.filter_by(slug=f'{slug}-{counter}').first():
        counter += 1
    return f'{slug}-{counter}'


def detect_repo_provider(url):
    """
    Auto-detect the git hosting provider from a repository URL.

    Args:
        url: A repository URL string (e.g., "https://github.com/user/repo").

    Returns:
        Provider string ('github', 'gitlab', 'bitbucket') or None if unknown.
    """
    if not url:
        return None

    try:
        hostname = urlparse(url).hostname or ''
    except Exception:
        return None

    hostname = hostname.lower()
    if 'github' in hostname:
        return 'github'
    elif 'gitlab' in hostname:
        return 'gitlab'
    elif 'bitbucket' in hostname:
        return 'bitbucket'
    return None


def extract_text_from_tiptap(doc_json):
    """
    Recursively extract plain text from a TipTap JSON document.

    Walks the document tree and concatenates all text nodes,
    producing a searchable plain-text representation of the
    rich-text content.

    Args:
        doc_json: The TipTap document as a Python dict (parsed JSON).

    Returns:
        A plain-text string with all text content joined by spaces.
        Returns empty string if doc_json is None or empty.
    """
    if not doc_json:
        return ''

    texts = []

    def walk(node):
        if isinstance(node, dict):
            # Text nodes have a 'text' key
            if 'text' in node:
                texts.append(node['text'])
            # Recurse into child nodes
            for child in node.get('content', []):
                walk(child)

    walk(doc_json)
    return ' '.join(texts)


def parse_wiki_links(doc_json):
    """
    Extract wiki link target slugs from a TipTap JSON document.

    Walks the document tree looking for nodes of type 'wikiLink'
    with a 'slug' attribute, which are created by the WikiLink
    TipTap extension.

    Args:
        doc_json: The TipTap document as a Python dict (parsed JSON).

    Returns:
        A set of slug strings referenced by wiki links in the document.
    """
    if not doc_json:
        return set()

    slugs = set()

    def walk(node):
        if isinstance(node, dict):
            if node.get('type') == 'wikiLink':
                slug = (node.get('attrs') or {}).get('slug')
                if slug:
                    slugs.add(slug)
            for child in node.get('content', []):
                walk(child)

    walk(doc_json)
    return slugs


def update_search_vector(article, db_session):
    """
    Update the PostgreSQL tsvector search_vector column for a KB article.

    Combines the article title (weighted A) and content_text (weighted B)
    into a single tsvector for full-text search with ts_rank().

    Args:
        article: A KBArticle instance with title and content_text set.
        db_session: The SQLAlchemy db.session for database operations.
    """
    from sqlalchemy import text

    title = article.title or ''
    body = article.content_text or ''

    db_session.execute(
        text("""
            UPDATE kb_articles
            SET search_vector = (
                setweight(to_tsvector('english', :title), 'A') ||
                setweight(to_tsvector('english', :body), 'B')
            )
            WHERE id = :id
        """),
        {'title': title, 'body': body, 'id': article.id}
    )


def tiptap_to_markdown(doc_json):
    """
    Convert a TipTap JSON document to Markdown text.

    Handles common node types: paragraphs, headings, lists, code blocks,
    blockquotes, images, links, horizontal rules, tables, and task lists.
    Inline marks (bold, italic, code, strikethrough, underline, highlight,
    link) are also supported.

    Args:
        doc_json: The TipTap document as a Python dict (parsed JSON).

    Returns:
        A Markdown string representation of the document.
    """
    if not doc_json:
        return ''

    lines = []

    def render_marks(text, marks):
        """Apply inline marks to text."""
        if not marks:
            return text
        for mark in marks:
            mt = mark.get('type', '')
            if mt == 'bold':
                text = f'**{text}**'
            elif mt == 'italic':
                text = f'*{text}*'
            elif mt == 'code':
                text = f'`{text}`'
            elif mt == 'strike':
                text = f'~~{text}~~'
            elif mt == 'underline':
                text = f'<u>{text}</u>'
            elif mt == 'highlight':
                text = f'=={text}=='
            elif mt == 'link':
                href = (mark.get('attrs') or {}).get('href', '')
                text = f'[{text}]({href})'
        return text

    def render_inline(node):
        """Render a single inline node to text."""
        if isinstance(node, str):
            return node
        ntype = node.get('type', '')
        if ntype == 'text':
            return render_marks(node.get('text', ''), node.get('marks'))
        if ntype == 'hardBreak':
            return '  \n'
        if ntype == 'wikiLink':
            attrs = node.get('attrs') or {}
            return f'[[{attrs.get("title", attrs.get("slug", ""))}]]'
        if ntype == 'image':
            attrs = node.get('attrs') or {}
            src = attrs.get('src', '')
            alt = attrs.get('alt', '')
            return f'![{alt}]({src})'
        return ''

    def render_content(content):
        """Render an array of inline nodes to a single text string."""
        if not content:
            return ''
        return ''.join(render_inline(c) for c in content)

    def render_node(node, list_depth=0):
        """Recursively render a block-level node to Markdown lines."""
        ntype = node.get('type', '')
        content = node.get('content', [])
        attrs = node.get('attrs') or {}

        if ntype == 'paragraph':
            lines.append(render_content(content))
            lines.append('')

        elif ntype == 'heading':
            level = attrs.get('level', 1)
            text = render_content(content)
            lines.append(f'{"#" * level} {text}')
            lines.append('')

        elif ntype == 'bulletList':
            for item in content:
                render_list_item(item, list_depth, ordered=False)
            if list_depth == 0:
                lines.append('')

        elif ntype == 'orderedList':
            for i, item in enumerate(content, 1):
                render_list_item(item, list_depth, ordered=True, index=i)
            if list_depth == 0:
                lines.append('')

        elif ntype == 'taskList':
            for item in content:
                render_task_item(item, list_depth)
            if list_depth == 0:
                lines.append('')

        elif ntype == 'codeBlock':
            lang = attrs.get('language', '')
            text = render_content(content)
            lines.append(f'```{lang}')
            lines.append(text)
            lines.append('```')
            lines.append('')

        elif ntype == 'blockquote':
            for child in content:
                # Temporarily capture child output
                old_len = len(lines)
                render_node(child, list_depth)
                # Prefix all new lines with >
                for i in range(old_len, len(lines)):
                    if lines[i]:
                        lines[i] = f'> {lines[i]}'

        elif ntype == 'horizontalRule':
            lines.append('---')
            lines.append('')

        elif ntype == 'table':
            render_table(content)

        elif ntype == 'calloutBlock':
            cb_type = attrs.get('type', 'info')
            lines.append(f'> **{cb_type.upper()}**')
            for child in content:
                old_len = len(lines)
                render_node(child, list_depth)
                for i in range(old_len, len(lines)):
                    if lines[i]:
                        lines[i] = f'> {lines[i]}'
            lines.append('')

        elif ntype == 'collapsibleBlock':
            summary_text = ''
            body_content = []
            for child in content:
                if child.get('type') == 'collapsibleSummary':
                    summary_text = render_content(child.get('content', []))
                elif child.get('type') == 'collapsibleContent':
                    body_content = child.get('content', [])
            lines.append(f'<details>')
            lines.append(f'<summary>{summary_text}</summary>')
            lines.append('')
            for child in body_content:
                render_node(child, list_depth)
            lines.append('</details>')
            lines.append('')

        elif ntype == 'mermaidBlock':
            code = attrs.get('code', '')
            lines.append('```mermaid')
            lines.append(code)
            lines.append('```')
            lines.append('')

        elif ntype == 'image':
            src = attrs.get('src', '')
            alt = attrs.get('alt', '')
            lines.append(f'![{alt}]({src})')
            lines.append('')

        elif ntype == 'doc':
            for child in content:
                render_node(child, list_depth)

        else:
            # Fallback: try to render content as text
            text = render_content(content)
            if text:
                lines.append(text)
                lines.append('')

    def render_list_item(item, depth, ordered=False, index=1):
        indent = '  ' * depth
        prefix = f'{index}.' if ordered else '-'
        item_content = item.get('content', [])
        first = True
        for child in item_content:
            if child.get('type') == 'paragraph':
                text = render_content(child.get('content', []))
                if first:
                    lines.append(f'{indent}{prefix} {text}')
                    first = False
                else:
                    lines.append(f'{indent}  {text}')
            elif child.get('type') in ('bulletList', 'orderedList', 'taskList'):
                render_node(child, depth + 1)
            else:
                text = render_content(child.get('content', []))
                if text:
                    lines.append(f'{indent}  {text}')

    def render_task_item(item, depth):
        indent = '  ' * depth
        attrs = item.get('attrs') or {}
        checked = attrs.get('checked', False)
        checkbox = '[x]' if checked else '[ ]'
        item_content = item.get('content', [])
        first = True
        for child in item_content:
            if child.get('type') == 'paragraph':
                text = render_content(child.get('content', []))
                if first:
                    lines.append(f'{indent}- {checkbox} {text}')
                    first = False
                else:
                    lines.append(f'{indent}  {text}')
            elif child.get('type') in ('bulletList', 'orderedList', 'taskList'):
                render_node(child, depth + 1)

    def render_table(rows):
        """Render a TipTap table to Markdown."""
        table_data = []
        is_header = []
        for row in rows:
            if row.get('type') != 'tableRow':
                continue
            cells = []
            header_row = False
            for cell in row.get('content', []):
                cell_type = cell.get('type', '')
                if cell_type == 'tableHeader':
                    header_row = True
                cell_text = render_content(
                    cell.get('content', [{}])[0].get('content', [])
                    if cell.get('content') else []
                )
                cells.append(cell_text)
            table_data.append(cells)
            is_header.append(header_row)

        if not table_data:
            return

        # Calculate column widths
        col_count = max(len(r) for r in table_data) if table_data else 0
        for row in table_data:
            while len(row) < col_count:
                row.append('')

        for i, row in enumerate(table_data):
            lines.append('| ' + ' | '.join(row) + ' |')
            if is_header[i] or i == 0:
                lines.append('| ' + ' | '.join('---' for _ in row) + ' |')
        lines.append('')

    render_node(doc_json)

    # Clean up trailing empty lines
    result = '\n'.join(lines).rstrip()
    return result


def markdown_to_tiptap(md_text):
    """
    Convert Markdown text to a minimal TipTap JSON document.

    Handles common block elements: paragraphs, headings (h1-h6),
    bullet lists, ordered lists, code blocks (fenced), blockquotes,
    horizontal rules, and inline marks (bold, italic, code, links, images).

    This is a best-effort conversion for import purposes — complex Markdown
    features (nested lists > 2 levels, HTML blocks, etc.) may lose some
    formatting.

    Args:
        md_text: A string of Markdown content.

    Returns:
        A TipTap-compatible JSON document dict.
    """
    import re as _re

    if not md_text:
        return {'type': 'doc', 'content': [{'type': 'paragraph'}]}

    lines = md_text.split('\n')
    content = []
    i = 0

    def parse_inline(text):
        """Parse inline Markdown (bold, italic, code, links, images) into TipTap inline nodes."""
        nodes = []
        # Regex pattern for inline elements
        pattern = _re.compile(
            r'!\[([^\]]*)\]\(([^)]+)\)'   # images
            r'|\[([^\]]*)\]\(([^)]+)\)'   # links
            r'|\*\*(.+?)\*\*'             # bold
            r'|\*(.+?)\*'                 # italic
            r'|`([^`]+)`'                 # inline code
            r'|~~(.+?)~~'                 # strikethrough
            r'|\[\[([^\]]+)\]\]'          # wiki links
        )

        last_end = 0
        for m in pattern.finditer(text):
            # Add preceding text
            if m.start() > last_end:
                nodes.append({'type': 'text', 'text': text[last_end:m.start()]})

            if m.group(1) is not None or m.group(2) is not None:
                # Image: ![alt](src)
                if m.group(0).startswith('!'):
                    nodes.append({
                        'type': 'image',
                        'attrs': {'src': m.group(2), 'alt': m.group(1) or ''},
                    })
                else:
                    # Shouldn't reach here, but fallback
                    nodes.append({'type': 'text', 'text': m.group(0)})
            elif m.group(3) is not None:
                # Link: [text](href)
                nodes.append({
                    'type': 'text',
                    'text': m.group(3),
                    'marks': [{'type': 'link', 'attrs': {'href': m.group(4)}}],
                })
            elif m.group(5) is not None:
                nodes.append({'type': 'text', 'text': m.group(5), 'marks': [{'type': 'bold'}]})
            elif m.group(6) is not None:
                nodes.append({'type': 'text', 'text': m.group(6), 'marks': [{'type': 'italic'}]})
            elif m.group(7) is not None:
                nodes.append({'type': 'text', 'text': m.group(7), 'marks': [{'type': 'code'}]})
            elif m.group(8) is not None:
                nodes.append({'type': 'text', 'text': m.group(8), 'marks': [{'type': 'strike'}]})
            elif m.group(9) is not None:
                # Wiki link
                title = m.group(9)
                slug = _re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
                nodes.append({
                    'type': 'wikiLink',
                    'attrs': {'slug': slug, 'title': title},
                })

            last_end = m.end()

        # Remaining text
        if last_end < len(text):
            remaining = text[last_end:]
            if remaining:
                nodes.append({'type': 'text', 'text': remaining})

        return nodes if nodes else [{'type': 'text', 'text': text}] if text else []

    def make_paragraph(text):
        nodes = parse_inline(text)
        return {'type': 'paragraph', 'content': nodes} if nodes else {'type': 'paragraph'}

    while i < len(lines):
        line = lines[i]

        # Fenced code block
        if line.startswith('```'):
            lang = line[3:].strip()
            code_lines = []
            i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                code_lines.append(lines[i])
                i += 1
            i += 1  # skip closing ```
            node = {
                'type': 'codeBlock',
                'attrs': {'language': lang} if lang else {},
                'content': [{'type': 'text', 'text': '\n'.join(code_lines)}] if code_lines else [],
            }
            content.append(node)
            continue

        # Heading
        heading_match = _re.match(r'^(#{1,6})\s+(.+)$', line)
        if heading_match:
            level = len(heading_match.group(1))
            text = heading_match.group(2)
            content.append({
                'type': 'heading',
                'attrs': {'level': level},
                'content': parse_inline(text),
            })
            i += 1
            continue

        # Horizontal rule
        if _re.match(r'^(---|\*\*\*|___)$', line.strip()):
            content.append({'type': 'horizontalRule'})
            i += 1
            continue

        # Blockquote
        if line.startswith('> '):
            quote_lines = []
            while i < len(lines) and lines[i].startswith('> '):
                quote_lines.append(lines[i][2:])
                i += 1
            # Simple: treat as paragraphs
            quote_content = []
            for ql in quote_lines:
                if ql.strip():
                    quote_content.append(make_paragraph(ql))
            if quote_content:
                content.append({'type': 'blockquote', 'content': quote_content})
            continue

        # Unordered list
        if _re.match(r'^[-*+]\s', line):
            items = []
            while i < len(lines) and _re.match(r'^[-*+]\s', lines[i]):
                item_text = _re.sub(r'^[-*+]\s', '', lines[i])
                items.append({
                    'type': 'listItem',
                    'content': [make_paragraph(item_text)],
                })
                i += 1
            content.append({'type': 'bulletList', 'content': items})
            continue

        # Ordered list
        if _re.match(r'^\d+\.\s', line):
            items = []
            while i < len(lines) and _re.match(r'^\d+\.\s', lines[i]):
                item_text = _re.sub(r'^\d+\.\s', '', lines[i])
                items.append({
                    'type': 'listItem',
                    'content': [make_paragraph(item_text)],
                })
                i += 1
            content.append({'type': 'orderedList', 'content': items})
            continue

        # Task list
        task_match = _re.match(r'^[-*]\s\[([ xX])\]\s(.+)$', line)
        if task_match:
            items = []
            while i < len(lines):
                tm = _re.match(r'^[-*]\s\[([ xX])\]\s(.+)$', lines[i])
                if not tm:
                    break
                checked = tm.group(1) in ('x', 'X')
                items.append({
                    'type': 'taskItem',
                    'attrs': {'checked': checked},
                    'content': [make_paragraph(tm.group(2))],
                })
                i += 1
            content.append({'type': 'taskList', 'content': items})
            continue

        # Empty line
        if not line.strip():
            i += 1
            continue

        # Default: paragraph
        content.append(make_paragraph(line))
        i += 1

    if not content:
        content = [{'type': 'paragraph'}]

    return {'type': 'doc', 'content': content}


def update_article_links(article, db_session):
    """
    Update the kb_article_links table for an article based on its
    current content_json. Call this after saving content.

    Parses wiki links from the TipTap JSON, resolves slugs to article
    IDs, then replaces the article's outgoing links.

    Args:
        article: A KBArticle instance with content_json set.
        db_session: The SQLAlchemy db.session for database operations.
    """
    from app.models.kb import KBArticle, KBArticleLink

    # Parse wiki link targets from the content
    target_slugs = parse_wiki_links(article.content_json)

    # Clear existing outgoing links
    KBArticleLink.query.filter_by(source_id=article.id).delete()

    if not target_slugs:
        return

    # Look up target articles by slug (exclude self-links)
    targets = (
        KBArticle.query
        .filter(KBArticle.slug.in_(target_slugs))
        .filter(KBArticle.id != article.id)
        .all()
    )

    # Create new link rows
    for target in targets:
        link = KBArticleLink(source_id=article.id, target_id=target.id)
        db_session.add(link)
