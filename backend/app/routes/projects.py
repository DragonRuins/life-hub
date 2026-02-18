"""
Project Tracker Module - API Routes

Full CRUD for software projects with kanban boards, tech stack tracking,
tagging, changelogs, and dashboard stats.

Route ordering note: /stats and /tags are registered BEFORE /<slug>
so Flask doesn't try to match "stats" or "tags" as a project slug.

Endpoints:
    # Projects CRUD
    GET    /api/projects/                          → List projects (with filters)
    POST   /api/projects/                          → Create a project
    GET    /api/projects/stats                     → Dashboard aggregate stats
    GET    /api/projects/<slug>                    → Get project with details
    PUT    /api/projects/<slug>                    → Update a project
    DELETE /api/projects/<slug>                    → Delete project (cascade)
    PUT    /api/projects/reorder                   → Reorder projects (DnD)

    # Tags (global)
    GET    /api/projects/tags                      → List all project tags
    POST   /api/projects/tags                      → Create a tag
    PUT    /api/projects/tags/<id>                 → Update a tag
    DELETE /api/projects/tags/<id>                 → Delete a tag
    POST   /api/projects/<slug>/tags               → Assign tag to project
    DELETE /api/projects/<slug>/tags/<tag_id>       → Remove tag from project

    # Tech Stack
    GET    /api/projects/<slug>/tech-stack          → List tech stack
    POST   /api/projects/<slug>/tech-stack          → Add technology
    DELETE /api/projects/tech-stack/<id>            → Remove technology

    # Kanban Columns
    GET    /api/projects/<slug>/columns             → List columns with tasks
    POST   /api/projects/<slug>/columns             → Add column
    PUT    /api/projects/columns/<id>               → Update column
    DELETE /api/projects/columns/<id>               → Delete column (if empty)
    PUT    /api/projects/<slug>/columns/reorder     → Reorder columns

    # Tasks
    GET    /api/projects/<slug>/tasks               → List tasks (with filters)
    POST   /api/projects/<slug>/tasks               → Create task
    GET    /api/projects/tasks/<id>                 → Get task detail
    PUT    /api/projects/tasks/<id>                 → Update task
    DELETE /api/projects/tasks/<id>                 → Delete task
    PUT    /api/projects/tasks/<id>/move            → Move task (column + position)
    PUT    /api/projects/<slug>/tasks/reorder       → Batch reorder (DnD)

    # Changelog
    GET    /api/projects/<slug>/changelog           → List changelog entries
    POST   /api/projects/<slug>/changelog           → Add changelog entry
    PUT    /api/projects/changelog/<id>             → Update entry
    DELETE /api/projects/changelog/<id>             → Delete entry
"""
from datetime import datetime, date, timezone

from flask import Blueprint, request, jsonify
from app import db
from app.models.project import (
    Project, ProjectTechStack, ProjectTag, project_tag_map,
    ProjectKanbanColumn, ProjectTask, ProjectChangelog
)
from app.utils import generate_slug, detect_repo_provider, extract_text_from_tiptap
from app.services.event_bus import emit

projects_bp = Blueprint('projects', __name__)


# ── Default kanban columns created with every new project ────────
DEFAULT_COLUMNS = [
    {'name': 'Backlog', 'sort_order': 0, 'is_done_column': False, 'wip_limit': None, 'color': '#a6adc8'},
    {'name': 'To Do', 'sort_order': 1, 'is_done_column': False, 'wip_limit': None, 'color': '#89b4fa'},
    {'name': 'In Progress', 'sort_order': 2, 'is_done_column': False, 'wip_limit': 3, 'color': '#fab387'},
    {'name': 'Done', 'sort_order': 3, 'is_done_column': True, 'wip_limit': None, 'color': '#a6e3a1'},
]


# ── Helper: parse optional date fields ───────────────────────────

def parse_date(value):
    """Parse a date string, returning None for empty/null values."""
    if not value or (isinstance(value, str) and value.strip() == ''):
        return None
    return date.fromisoformat(value)


def get_project_by_slug(slug):
    """Look up a project by slug, returning 404 if not found."""
    project = Project.query.filter_by(slug=slug).first()
    if not project:
        return None
    return project


# ══════════════════════════════════════════════════════════════════
# ── Projects CRUD ────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════


@projects_bp.route('/', methods=['GET'])
def list_projects():
    """
    List projects with optional filtering and sorting.

    Query parameters:
        ?status=active        → Filter by status (default: excludes completed/archived)
        ?tag=tag_name         → Filter by tag name
        ?search=keyword       → Search name and description
        ?sort=sort_order      → Sort field (sort_order, name, created_at, updated_at)
        ?show_all=true        → Include completed and archived projects
    """
    query = Project.query

    # By default, exclude completed and archived projects
    show_all = request.args.get('show_all') == 'true'
    status_filter = request.args.get('status')
    if status_filter:
        query = query.filter(Project.status == status_filter)
    elif not show_all:
        query = query.filter(Project.status.notin_(['completed', 'archived']))

    # Filter by tag
    tag_name = request.args.get('tag')
    if tag_name:
        query = query.filter(Project.tags.any(ProjectTag.name == tag_name))

    # Search name and description
    search = request.args.get('search')
    if search:
        search_term = f'%{search}%'
        query = query.filter(
            db.or_(
                Project.name.ilike(search_term),
                Project.description.ilike(search_term),
            )
        )

    # Sorting
    sort_field = request.args.get('sort', 'sort_order')
    sort_column = {
        'sort_order': Project.sort_order,
        'name': Project.name,
        'created_at': Project.created_at,
        'updated_at': Project.updated_at,
    }.get(sort_field, Project.sort_order)

    if sort_field == 'name':
        query = query.order_by(sort_column.asc())
    elif sort_field in ('created_at', 'updated_at'):
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    projects = query.all()
    return jsonify([p.to_dict(include_details=False) for p in projects])


@projects_bp.route('/', methods=['POST'])
def create_project():
    """
    Create a new project with auto-generated slug and default kanban columns.

    Expects JSON:
    {
        "name": "Datacore",
        "description": "Personal dashboard app",
        "status": "active",
        "color": "#89b4fa",
        "repo_url": "https://github.com/user/repo",
        "live_url": "https://example.com",
        "started_at": "2024-01-15"
    }
    """
    data = request.get_json()

    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Project name is required'}), 400

    # Auto-generate slug and detect repo provider
    slug = generate_slug(name)
    repo_url = data.get('repo_url', '').strip() or None
    repo_provider = detect_repo_provider(repo_url)

    # Find the next sort_order value
    max_sort = db.session.query(db.func.max(Project.sort_order)).scalar() or 0

    project = Project(
        name=name,
        slug=slug,
        description=data.get('description', '').strip() or None,
        status=data.get('status', 'active'),
        visibility=data.get('visibility', 'private'),
        repo_url=repo_url,
        repo_provider=repo_provider,
        live_url=data.get('live_url', '').strip() or None,
        color=data.get('color'),
        icon=data.get('icon'),
        sort_order=max_sort + 1,
        started_at=parse_date(data.get('started_at')),
    )
    db.session.add(project)
    db.session.flush()  # Get the project.id before creating columns

    # Create default kanban columns
    for col_def in DEFAULT_COLUMNS:
        column = ProjectKanbanColumn(
            project_id=project.id,
            name=col_def['name'],
            color=col_def['color'],
            sort_order=col_def['sort_order'],
            is_done_column=col_def['is_done_column'],
            wip_limit=col_def['wip_limit'],
        )
        db.session.add(column)

    db.session.commit()

    # Emit notification event
    try:
        emit('project.created', project_name=project.name, slug=project.slug)
    except Exception:
        pass

    return jsonify(project.to_dict()), 201


@projects_bp.route('/stats', methods=['GET'])
def get_stats():
    """
    Aggregate stats for dashboard summary cards.

    Returns project counts, task counts, and recent tasks.
    """
    active_count = Project.query.filter(
        Project.status.in_(['active', 'planning', 'paused'])
    ).count()

    total_tasks = ProjectTask.query.count()
    done_columns = ProjectKanbanColumn.query.filter_by(is_done_column=True).all()
    done_column_ids = [c.id for c in done_columns]

    tasks_completed = 0
    tasks_in_progress = 0
    if done_column_ids:
        tasks_completed = ProjectTask.query.filter(
            ProjectTask.column_id.in_(done_column_ids)
        ).count()
        tasks_in_progress = total_tasks - tasks_completed

    # Overdue tasks (due_date in the past, not completed)
    overdue_tasks = ProjectTask.query.filter(
        ProjectTask.due_date < date.today(),
        ProjectTask.completed_at.is_(None)
    ).count()

    # Recently updated tasks (top 5)
    recent_tasks = (
        ProjectTask.query
        .join(Project, ProjectTask.project_id == Project.id)
        .order_by(ProjectTask.updated_at.desc())
        .limit(5)
        .all()
    )

    recent_tasks_list = []
    for task in recent_tasks:
        task_dict = task.to_dict()
        task_dict['project_name'] = task.project.name
        task_dict['project_slug'] = task.project.slug
        recent_tasks_list.append(task_dict)

    return jsonify({
        'active_projects': active_count,
        'total_tasks': total_tasks,
        'tasks_completed': tasks_completed,
        'tasks_in_progress': tasks_in_progress,
        'overdue_tasks': overdue_tasks,
        'recent_tasks': recent_tasks_list,
    })


@projects_bp.route('/reorder', methods=['PUT'])
def reorder_projects():
    """
    Update sort_order for multiple projects (drag-and-drop reorder).

    Expects JSON:
    { "ids": [3, 1, 5, 2, 4] }   → IDs in desired display order
    """
    data = request.get_json()
    ids = data.get('ids', [])

    for index, project_id in enumerate(ids):
        project = Project.query.get(project_id)
        if project:
            project.sort_order = index

    db.session.commit()
    return jsonify({'message': 'Projects reordered'})


@projects_bp.route('/<slug>', methods=['GET'])
def get_project(slug):
    """Get full project details including tech stack, tags, columns, and changelog."""
    project = get_project_by_slug(slug)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    return jsonify(project.to_dict(include_details=True))


@projects_bp.route('/<slug>', methods=['PUT'])
def update_project(slug):
    """
    Update a project. Supports partial updates.
    Only fields present in the request body are updated.
    """
    project = get_project_by_slug(slug)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    data = request.get_json()
    old_status = project.status

    if 'name' in data:
        new_name = data['name'].strip()
        if not new_name:
            return jsonify({'error': 'Project name is required'}), 400
        project.name = new_name
        # Regenerate slug if name changed
        if new_name != project.name:
            project.slug = generate_slug(new_name)

    if 'description' in data:
        project.description = data['description'].strip() or None
    if 'status' in data:
        project.status = data['status']
        # Auto-set completed_at when status changes to 'completed'
        if data['status'] == 'completed' and not project.completed_at:
            project.completed_at = date.today()
        elif data['status'] != 'completed':
            project.completed_at = None
    if 'visibility' in data:
        project.visibility = data['visibility']
    if 'repo_url' in data:
        project.repo_url = data['repo_url'].strip() or None
        project.repo_provider = detect_repo_provider(project.repo_url)
    if 'live_url' in data:
        project.live_url = data['live_url'].strip() or None
    if 'color' in data:
        project.color = data['color']
    if 'icon' in data:
        project.icon = data['icon']
    if 'started_at' in data:
        project.started_at = parse_date(data['started_at'])

    db.session.commit()

    # Emit notification if status changed
    if 'status' in data and data['status'] != old_status:
        try:
            emit('project.status_changed',
                 project_name=project.name,
                 slug=project.slug,
                 old_status=old_status,
                 new_status=data['status'])
        except Exception:
            pass

    return jsonify(project.to_dict())


@projects_bp.route('/<slug>', methods=['DELETE'])
def delete_project(slug):
    """Delete a project and all related data (cascade)."""
    project = get_project_by_slug(slug)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    project_name = project.name
    db.session.delete(project)
    db.session.commit()
    return jsonify({'message': f'Project "{project_name}" deleted'}), 200


# ══════════════════════════════════════════════════════════════════
# ── Tags CRUD (global) ──────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════


@projects_bp.route('/tags', methods=['GET'])
def list_tags():
    """List all project tags with project counts."""
    tags = ProjectTag.query.order_by(ProjectTag.name).all()
    return jsonify([t.to_dict(include_project_count=True) for t in tags])


@projects_bp.route('/tags', methods=['POST'])
def create_tag():
    """
    Create a new project tag.

    Expects JSON:
    { "name": "web-app", "color": "#89b4fa" }
    """
    data = request.get_json()
    name = data.get('name', '').strip()

    if not name:
        return jsonify({'error': 'Tag name is required'}), 400

    existing = ProjectTag.query.filter(db.func.lower(ProjectTag.name) == name.lower()).first()
    if existing:
        return jsonify({'error': 'Tag already exists', 'tag': existing.to_dict()}), 409

    tag = ProjectTag(name=name, color=data.get('color'))
    db.session.add(tag)
    db.session.commit()
    return jsonify(tag.to_dict(include_project_count=True)), 201


@projects_bp.route('/tags/<int:tag_id>', methods=['PUT'])
def update_tag(tag_id):
    """Update a project tag's name or color."""
    tag = ProjectTag.query.get_or_404(tag_id)
    data = request.get_json()

    if 'name' in data:
        name = data['name'].strip()
        if not name:
            return jsonify({'error': 'Tag name is required'}), 400
        existing = ProjectTag.query.filter(
            db.func.lower(ProjectTag.name) == name.lower(),
            ProjectTag.id != tag_id
        ).first()
        if existing:
            return jsonify({'error': 'Tag name already in use'}), 409
        tag.name = name

    if 'color' in data:
        tag.color = data['color']

    db.session.commit()
    return jsonify(tag.to_dict(include_project_count=True))


@projects_bp.route('/tags/<int:tag_id>', methods=['DELETE'])
def delete_tag(tag_id):
    """Delete a project tag. Removes it from all projects but does not delete projects."""
    tag = ProjectTag.query.get_or_404(tag_id)
    db.session.delete(tag)
    db.session.commit()
    return jsonify({'message': 'Tag deleted'}), 200


@projects_bp.route('/<slug>/tags', methods=['POST'])
def assign_tag(slug):
    """
    Assign a tag to a project.

    Expects JSON:
    { "tag_id": 5 }
    """
    project = get_project_by_slug(slug)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    data = request.get_json()
    tag_id = data.get('tag_id')
    if not tag_id:
        return jsonify({'error': 'tag_id is required'}), 400

    tag = ProjectTag.query.get_or_404(tag_id)

    if tag in project.tags:
        return jsonify({'message': 'Tag already assigned'}), 200

    project.tags.append(tag)
    db.session.commit()
    return jsonify(project.to_dict(include_details=False)), 200


@projects_bp.route('/<slug>/tags/<int:tag_id>', methods=['DELETE'])
def remove_tag(slug, tag_id):
    """Remove a tag from a project."""
    project = get_project_by_slug(slug)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    tag = ProjectTag.query.get_or_404(tag_id)

    if tag in project.tags:
        project.tags.remove(tag)
        db.session.commit()

    return jsonify({'message': 'Tag removed'}), 200


# ══════════════════════════════════════════════════════════════════
# ── Tech Stack CRUD ──────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════


@projects_bp.route('/<slug>/tech-stack', methods=['GET'])
def list_tech_stack(slug):
    """List all technologies for a project."""
    project = get_project_by_slug(slug)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    return jsonify([ts.to_dict() for ts in project.tech_stack])


@projects_bp.route('/<slug>/tech-stack', methods=['POST'])
def add_tech_stack(slug):
    """
    Add a technology to a project's tech stack.

    Expects JSON:
    { "name": "React", "category": "framework", "version": "19" }
    """
    project = get_project_by_slug(slug)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    data = request.get_json()
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Technology name is required'}), 400

    # Check for duplicate within this project
    existing = ProjectTechStack.query.filter_by(
        project_id=project.id, name=name
    ).first()
    if existing:
        return jsonify({'error': f'"{name}" already in tech stack'}), 409

    max_sort = db.session.query(
        db.func.max(ProjectTechStack.sort_order)
    ).filter_by(project_id=project.id).scalar() or 0

    tech = ProjectTechStack(
        project_id=project.id,
        name=name,
        category=data.get('category'),
        version=data.get('version'),
        sort_order=max_sort + 1,
    )
    db.session.add(tech)
    db.session.commit()
    return jsonify(tech.to_dict()), 201


@projects_bp.route('/tech-stack/<int:tech_id>', methods=['DELETE'])
def delete_tech_stack(tech_id):
    """Remove a technology from a project's tech stack."""
    tech = ProjectTechStack.query.get_or_404(tech_id)
    db.session.delete(tech)
    db.session.commit()
    return jsonify({'message': 'Technology removed'}), 200


# ══════════════════════════════════════════════════════════════════
# ── Kanban Columns CRUD ─────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════


@projects_bp.route('/<slug>/columns', methods=['GET'])
def list_columns(slug):
    """List kanban columns for a project, each with its tasks."""
    project = get_project_by_slug(slug)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    columns = ProjectKanbanColumn.query.filter_by(
        project_id=project.id
    ).order_by(ProjectKanbanColumn.sort_order).all()

    return jsonify([c.to_dict(include_tasks=True) for c in columns])


@projects_bp.route('/<slug>/columns', methods=['POST'])
def create_column(slug):
    """
    Add a new kanban column to a project.

    Expects JSON:
    { "name": "Testing", "color": "#f9e2af", "wip_limit": 5 }
    """
    project = get_project_by_slug(slug)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    data = request.get_json()
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Column name is required'}), 400

    max_sort = db.session.query(
        db.func.max(ProjectKanbanColumn.sort_order)
    ).filter_by(project_id=project.id).scalar() or 0

    column = ProjectKanbanColumn(
        project_id=project.id,
        name=name,
        color=data.get('color'),
        sort_order=max_sort + 1,
        is_done_column=data.get('is_done_column', False),
        wip_limit=data.get('wip_limit'),
    )
    db.session.add(column)
    db.session.commit()
    return jsonify(column.to_dict()), 201


@projects_bp.route('/columns/<int:column_id>', methods=['PUT'])
def update_column(column_id):
    """Update a kanban column's properties."""
    column = ProjectKanbanColumn.query.get_or_404(column_id)
    data = request.get_json()

    if 'name' in data:
        name = data['name'].strip()
        if not name:
            return jsonify({'error': 'Column name is required'}), 400
        column.name = name
    if 'color' in data:
        column.color = data['color']
    if 'is_done_column' in data:
        column.is_done_column = data['is_done_column']
    if 'wip_limit' in data:
        column.wip_limit = data['wip_limit'] if data['wip_limit'] else None

    db.session.commit()
    return jsonify(column.to_dict())


@projects_bp.route('/columns/<int:column_id>', methods=['DELETE'])
def delete_column(column_id):
    """
    Delete a kanban column. Returns error if column still has tasks —
    tasks must be moved or deleted first.
    """
    column = ProjectKanbanColumn.query.get_or_404(column_id)

    if len(column.tasks) > 0:
        return jsonify({
            'error': f'Column "{column.name}" still has {len(column.tasks)} task(s). '
                     'Move or delete them first.'
        }), 400

    db.session.delete(column)
    db.session.commit()
    return jsonify({'message': 'Column deleted'}), 200


@projects_bp.route('/<slug>/columns/reorder', methods=['PUT'])
def reorder_columns(slug):
    """
    Reorder kanban columns for a project.

    Expects JSON:
    { "ids": [4, 2, 1, 3, 5] }   → Column IDs in desired order
    """
    project = get_project_by_slug(slug)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    data = request.get_json()
    ids = data.get('ids', [])

    for index, col_id in enumerate(ids):
        column = ProjectKanbanColumn.query.get(col_id)
        if column and column.project_id == project.id:
            column.sort_order = index

    db.session.commit()
    return jsonify({'message': 'Columns reordered'})


# ══════════════════════════════════════════════════════════════════
# ── Tasks CRUD ───────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════


@projects_bp.route('/<slug>/tasks', methods=['GET'])
def list_tasks(slug):
    """
    List all tasks for a project.

    Query parameters:
        ?column_id=3        → Filter by column
        ?priority=high      → Filter by priority
        ?label=bug          → Filter by label
        ?overdue=true       → Only overdue tasks (due_date past, not completed)
    """
    project = get_project_by_slug(slug)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    query = ProjectTask.query.filter_by(project_id=project.id)

    column_id = request.args.get('column_id')
    if column_id:
        query = query.filter(ProjectTask.column_id == int(column_id))

    priority = request.args.get('priority')
    if priority:
        query = query.filter(ProjectTask.priority == priority)

    label = request.args.get('label')
    if label:
        # Search within JSONB array
        query = query.filter(ProjectTask.labels.contains([label]))

    if request.args.get('overdue') == 'true':
        query = query.filter(
            ProjectTask.due_date < date.today(),
            ProjectTask.completed_at.is_(None)
        )

    tasks = query.order_by(ProjectTask.sort_order).all()
    return jsonify([t.to_dict() for t in tasks])


@projects_bp.route('/<slug>/tasks', methods=['POST'])
def create_task(slug):
    """
    Create a new task in a kanban column.

    Expects JSON:
    {
        "column_id": 3,
        "title": "Implement login page",
        "priority": "normal",    // optional, defaults to "normal"
        "description_json": {},  // optional TipTap JSON
        "due_date": "2024-03-15",  // optional
        "labels": ["feature"],     // optional
        "estimated_hours": 4.0     // optional
    }
    """
    project = get_project_by_slug(slug)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    data = request.get_json()

    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': 'Task title is required'}), 400

    column_id = data.get('column_id')
    if not column_id:
        return jsonify({'error': 'column_id is required'}), 400

    # Verify column belongs to this project
    column = ProjectKanbanColumn.query.get(column_id)
    if not column or column.project_id != project.id:
        return jsonify({'error': 'Invalid column_id for this project'}), 400

    # Gap-based sort ordering: place at the end of the column
    max_sort = db.session.query(
        db.func.max(ProjectTask.sort_order)
    ).filter_by(column_id=column_id).scalar()
    next_sort = (max_sort or 0) + 1000

    # Extract plain text from TipTap JSON for search
    description_json = data.get('description_json')
    description_text = extract_text_from_tiptap(description_json)

    task = ProjectTask(
        project_id=project.id,
        column_id=column_id,
        title=title,
        description_json=description_json,
        description_text=description_text,
        priority=data.get('priority', 'normal'),
        sort_order=next_sort,
        due_date=parse_date(data.get('due_date')),
        labels=data.get('labels', []),
        estimated_hours=data.get('estimated_hours'),
    )

    # If creating directly in a done column, auto-set completed_at
    if column.is_done_column:
        task.completed_at = datetime.now(timezone.utc)

    db.session.add(task)
    db.session.commit()

    try:
        emit('project.task_created',
             project_name=project.name,
             slug=project.slug,
             task_title=task.title,
             column_name=column.name,
             priority=task.priority)
    except Exception:
        pass

    return jsonify(task.to_dict()), 201


@projects_bp.route('/tasks/<int:task_id>', methods=['GET'])
def get_task(task_id):
    """Get a single task with full details."""
    task = ProjectTask.query.get_or_404(task_id)
    return jsonify(task.to_dict())


@projects_bp.route('/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    """
    Update a task. Supports partial updates.
    Only fields present in the request body are updated.
    """
    task = ProjectTask.query.get_or_404(task_id)
    data = request.get_json()

    if 'title' in data:
        title = data['title'].strip()
        if not title:
            return jsonify({'error': 'Task title is required'}), 400
        task.title = title

    if 'description_json' in data:
        task.description_json = data['description_json']
        task.description_text = extract_text_from_tiptap(data['description_json'])

    if 'priority' in data:
        task.priority = data['priority']
    if 'due_date' in data:
        task.due_date = parse_date(data['due_date'])
    if 'labels' in data:
        task.labels = data['labels']
    if 'estimated_hours' in data:
        task.estimated_hours = data['estimated_hours'] if data['estimated_hours'] else None

    db.session.commit()
    return jsonify(task.to_dict())


@projects_bp.route('/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    """Delete a task."""
    task = ProjectTask.query.get_or_404(task_id)
    db.session.delete(task)
    db.session.commit()
    return jsonify({'message': 'Task deleted'}), 200


@projects_bp.route('/tasks/<int:task_id>/move', methods=['PUT'])
def move_task(task_id):
    """
    Move a task to a different column and/or position.

    If moved to a done column, auto-sets completed_at.
    If moved out of a done column, clears completed_at.

    Expects JSON:
    { "column_id": 5, "sort_order": 2500.0 }
    """
    task = ProjectTask.query.get_or_404(task_id)
    data = request.get_json()

    new_column_id = data.get('column_id', task.column_id)
    new_sort_order = data.get('sort_order', task.sort_order)

    # Verify column belongs to the same project
    new_column = ProjectKanbanColumn.query.get(new_column_id)
    if not new_column or new_column.project_id != task.project_id:
        return jsonify({'error': 'Invalid column_id'}), 400

    old_column = task.column

    task.column_id = new_column_id
    task.sort_order = new_sort_order

    # Auto-manage completed_at based on done column
    if new_column.is_done_column and not task.completed_at:
        task.completed_at = datetime.now(timezone.utc)
    elif not new_column.is_done_column and task.completed_at:
        task.completed_at = None

    db.session.commit()

    # Emit notification when task is completed
    if new_column.is_done_column and (not old_column or not old_column.is_done_column):
        try:
            emit('project.task_completed',
                 project_name=task.project.name,
                 slug=task.project.slug,
                 task_title=task.title)
        except Exception:
            pass

    return jsonify(task.to_dict())


@projects_bp.route('/<slug>/tasks/reorder', methods=['PUT'])
def batch_reorder(slug):
    """
    Batch reorder tasks across columns (primary drag-and-drop endpoint).

    Expects JSON:
    {
        "items": [
            { "id": 1, "column_id": 3, "sort_order": 1000.0 },
            { "id": 5, "column_id": 3, "sort_order": 2000.0 },
            { "id": 2, "column_id": 4, "sort_order": 1000.0 }
        ]
    }
    """
    project = get_project_by_slug(slug)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    data = request.get_json()
    items = data.get('items', [])

    # Pre-fetch done column IDs for this project
    done_column_ids = set(
        c.id for c in project.columns if c.is_done_column
    )

    for item in items:
        task = ProjectTask.query.get(item['id'])
        if not task or task.project_id != project.id:
            continue

        old_column_id = task.column_id
        new_column_id = item.get('column_id', task.column_id)

        task.column_id = new_column_id
        task.sort_order = item.get('sort_order', task.sort_order)

        # Auto-manage completed_at based on done column
        moving_to_done = new_column_id in done_column_ids
        was_in_done = old_column_id in done_column_ids

        if moving_to_done and not task.completed_at:
            task.completed_at = datetime.now(timezone.utc)
        elif not moving_to_done and task.completed_at:
            task.completed_at = None

        # Emit notification for newly completed tasks
        if moving_to_done and not was_in_done:
            try:
                emit('project.task_completed',
                     project_name=project.name,
                     slug=project.slug,
                     task_title=task.title)
            except Exception:
                pass

    db.session.commit()
    return jsonify({'message': 'Tasks reordered'})


# ══════════════════════════════════════════════════════════════════
# ── Changelog CRUD ───────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════


@projects_bp.route('/<slug>/changelog', methods=['GET'])
def list_changelog(slug):
    """
    List changelog entries for a project, newest first.

    Query parameters:
        ?entry_type=release   → Filter by entry type
    """
    project = get_project_by_slug(slug)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    query = ProjectChangelog.query.filter_by(project_id=project.id)

    entry_type = request.args.get('entry_type')
    if entry_type:
        query = query.filter(ProjectChangelog.entry_type == entry_type)

    entries = query.order_by(ProjectChangelog.entry_date.desc()).all()
    return jsonify([e.to_dict() for e in entries])


@projects_bp.route('/<slug>/changelog', methods=['POST'])
def create_changelog(slug):
    """
    Add a changelog entry to a project.

    Expects JSON:
    {
        "entry_type": "release",
        "title": "v1.2.0 Released",
        "description": "Major feature update...",
        "version": "1.2.0",
        "entry_date": "2024-02-15"
    }
    """
    project = get_project_by_slug(slug)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    data = request.get_json()

    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': 'Title is required'}), 400

    entry_type = data.get('entry_type', '').strip()
    if not entry_type:
        return jsonify({'error': 'Entry type is required'}), 400

    entry = ProjectChangelog(
        project_id=project.id,
        entry_type=entry_type,
        title=title,
        description=data.get('description', '').strip() or None,
        version=data.get('version', '').strip() or None,
        entry_date=parse_date(data.get('entry_date')) or date.today(),
    )
    db.session.add(entry)
    db.session.commit()
    return jsonify(entry.to_dict()), 201


@projects_bp.route('/changelog/<int:entry_id>', methods=['PUT'])
def update_changelog(entry_id):
    """Update a changelog entry. Supports partial updates."""
    entry = ProjectChangelog.query.get_or_404(entry_id)
    data = request.get_json()

    if 'entry_type' in data:
        entry.entry_type = data['entry_type']
    if 'title' in data:
        title = data['title'].strip()
        if not title:
            return jsonify({'error': 'Title is required'}), 400
        entry.title = title
    if 'description' in data:
        entry.description = data['description'].strip() or None
    if 'version' in data:
        entry.version = data['version'].strip() or None
    if 'entry_date' in data:
        entry.entry_date = parse_date(data['entry_date']) or entry.entry_date

    db.session.commit()
    return jsonify(entry.to_dict())


@projects_bp.route('/changelog/<int:entry_id>', methods=['DELETE'])
def delete_changelog(entry_id):
    """Delete a changelog entry."""
    entry = ProjectChangelog.query.get_or_404(entry_id)
    db.session.delete(entry)
    db.session.commit()
    return jsonify({'message': 'Changelog entry deleted'}), 200
