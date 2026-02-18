"""
Utility functions shared across the Life Hub application.
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
