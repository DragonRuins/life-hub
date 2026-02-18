"""
Project Tracker Module - Database Models

Seven tables for software project management with kanban boards:
  - projects: Core project record (name, status, repo URL, etc.)
  - project_tech_stack: Technologies used per project
  - project_tags: Global tags for categorizing projects
  - project_tag_map: Many-to-many join between projects and tags
  - project_kanban_columns: Customizable kanban columns per project
  - project_tasks: Individual tasks within a kanban board
  - project_changelog: Timeline of milestones, releases, and notes

Each project gets auto-generated default kanban columns on creation.
Projects are identified by URL-friendly slugs (auto-generated from name).
"""
from datetime import datetime, date, timezone
from sqlalchemy.dialects.postgresql import JSONB
from app import db


# ── Association Table ────────────────────────────────────────────

# Many-to-many linking projects to tags (same pattern as note_tags in tag.py)
project_tag_map = db.Table(
    'project_tag_map',
    db.Column('project_id', db.Integer, db.ForeignKey('projects.id', ondelete='CASCADE'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('project_tags.id', ondelete='CASCADE'), primary_key=True),
)


# ── Project ──────────────────────────────────────────────────────

class Project(db.Model):
    """A software project with kanban board, tech stack, and changelog."""
    __tablename__ = 'projects'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    slug = db.Column(db.String(255), nullable=False, unique=True)  # URL-safe, auto-generated from name
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(50), nullable=False, default='active')  # planning, active, paused, completed, archived
    visibility = db.Column(db.String(50), default='private')  # For future use: private, public

    # Links
    repo_url = db.Column(db.String(500), nullable=True)
    repo_provider = db.Column(db.String(50), nullable=True)  # Auto-detected: github, gitlab, bitbucket
    live_url = db.Column(db.String(500), nullable=True)

    # Visual
    color = db.Column(db.String(7), nullable=True)    # Hex color from preset palette
    icon = db.Column(db.String(100), nullable=True)    # Optional emoji or icon name

    # Ordering
    sort_order = db.Column(db.Integer, nullable=False, default=0)

    # Dates
    started_at = db.Column(db.Date, nullable=True)
    completed_at = db.Column(db.Date, nullable=True)

    # Extensible data for future integrations (GitHub data, etc.)
    # Note: 'metadata' is reserved by SQLAlchemy's Declarative API,
    # so this column is named 'extra_data' in Python and the DB.
    extra_data = db.Column(JSONB, nullable=True, default=dict)

    # Timestamps
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    tech_stack = db.relationship(
        'ProjectTechStack', backref='project',
        cascade='all, delete-orphan',
        order_by='ProjectTechStack.sort_order'
    )
    columns = db.relationship(
        'ProjectKanbanColumn', backref='project',
        cascade='all, delete-orphan',
        order_by='ProjectKanbanColumn.sort_order'
    )
    tasks = db.relationship(
        'ProjectTask', backref='project',
        cascade='all, delete-orphan'
    )
    changelog = db.relationship(
        'ProjectChangelog', backref='project',
        cascade='all, delete-orphan',
        order_by='ProjectChangelog.entry_date.desc()'
    )
    tags = db.relationship(
        'ProjectTag', secondary=project_tag_map,
        backref='projects', lazy='joined'
    )

    __table_args__ = (
        db.Index('ix_projects_slug', 'slug'),
        db.Index('ix_projects_status', 'status'),
    )

    def to_dict(self, include_details=True):
        """
        Convert to dictionary for JSON responses.

        Args:
            include_details: If False, omits tech_stack, columns, and changelog
                           for lightweight list views.
        """
        result = {
            'id': self.id,
            'name': self.name,
            'slug': self.slug,
            'description': self.description,
            'status': self.status,
            'visibility': self.visibility,
            'repo_url': self.repo_url,
            'repo_provider': self.repo_provider,
            'live_url': self.live_url,
            'color': self.color,
            'icon': self.icon,
            'sort_order': self.sort_order,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'extra_data': self.extra_data or {},
            'tags': [t.to_dict() for t in self.tags],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

        if include_details:
            result['tech_stack'] = [ts.to_dict() for ts in self.tech_stack]
            result['columns'] = [c.to_dict() for c in self.columns]
            result['changelog'] = [cl.to_dict() for cl in self.changelog[:10]]  # Last 10 entries
        else:
            # Lightweight counts for list views
            result['tech_stack_count'] = len(self.tech_stack)
            # Task progress: count done vs total
            total_tasks = len(self.tasks)
            done_tasks = sum(1 for t in self.tasks if t.completed_at is not None)
            result['task_count'] = total_tasks
            result['done_task_count'] = done_tasks
            # First few tech stack items for card previews
            result['tech_stack_preview'] = [ts.to_dict() for ts in self.tech_stack[:4]]

        return result


# ── Tech Stack ───────────────────────────────────────────────────

class ProjectTechStack(db.Model):
    """A technology used in a project (e.g., React, Flask, PostgreSQL)."""
    __tablename__ = 'project_tech_stack'

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    name = db.Column(db.String(100), nullable=False)        # e.g., "React", "Python"
    category = db.Column(db.String(50), nullable=True)       # language, framework, database, tool, platform, service, other
    version = db.Column(db.String(50), nullable=True)        # e.g., "3.12", "19"
    sort_order = db.Column(db.Integer, default=0)

    __table_args__ = (
        db.UniqueConstraint('project_id', 'name', name='uq_project_tech_stack'),
        db.Index('ix_project_tech_stack_project_id', 'project_id'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'project_id': self.project_id,
            'name': self.name,
            'category': self.category,
            'version': self.version,
            'sort_order': self.sort_order,
        }


# ── Tags ─────────────────────────────────────────────────────────

class ProjectTag(db.Model):
    """A reusable tag for categorizing projects (e.g., 'web-app', 'automation')."""
    __tablename__ = 'project_tags'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    color = db.Column(db.String(7), nullable=True)  # Hex color, e.g., "#89b4fa"
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.Index('ix_project_tags_name', 'name'),
    )

    def to_dict(self, include_project_count=False):
        """Convert to dictionary for JSON responses."""
        result = {
            'id': self.id,
            'name': self.name,
            'color': self.color,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_project_count:
            result['project_count'] = len(self.projects)
        return result


# ── Kanban Columns ───────────────────────────────────────────────

class ProjectKanbanColumn(db.Model):
    """A customizable column in a project's kanban board."""
    __tablename__ = 'project_kanban_columns'

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    name = db.Column(db.String(100), nullable=False)         # e.g., "Backlog", "In Progress"
    color = db.Column(db.String(7), nullable=True)            # Hex color for column header
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    is_done_column = db.Column(db.Boolean, default=False)     # Tasks here count as "completed"
    wip_limit = db.Column(db.Integer, nullable=True)          # Optional work-in-progress limit
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Tasks within this column, ordered by sort_order
    tasks = db.relationship(
        'ProjectTask', backref='column',
        cascade='all, delete-orphan',
        order_by='ProjectTask.sort_order'
    )

    __table_args__ = (
        db.Index('ix_project_kanban_columns_project_id', 'project_id'),
    )

    def to_dict(self, include_tasks=False):
        """
        Convert to dictionary for JSON responses.

        Args:
            include_tasks: If True, includes the full list of tasks in this column.
        """
        result = {
            'id': self.id,
            'project_id': self.project_id,
            'name': self.name,
            'color': self.color,
            'sort_order': self.sort_order,
            'is_done_column': self.is_done_column,
            'wip_limit': self.wip_limit,
            'task_count': len(self.tasks),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_tasks:
            result['tasks'] = [t.to_dict() for t in self.tasks]
        return result


# ── Tasks ────────────────────────────────────────────────────────

class ProjectTask(db.Model):
    """A task/TODO on a project's kanban board."""
    __tablename__ = 'project_tasks'

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    column_id = db.Column(db.Integer, db.ForeignKey('project_kanban_columns.id', ondelete='CASCADE'), nullable=False)
    title = db.Column(db.String(500), nullable=False)

    # Rich text description stored as TipTap JSON (lightweight StarterKit only)
    description_json = db.Column(JSONB, nullable=True)
    # Plain-text extraction for search (populated via extract_text_from_tiptap)
    description_text = db.Column(db.Text, nullable=True)

    priority = db.Column(db.String(20), nullable=False, default='normal')  # low, normal, high, critical

    # Float for gap-based drag-and-drop ordering (allows inserting between items
    # without renumbering everything: avg of neighbors)
    sort_order = db.Column(db.Float, nullable=False, default=0)

    due_date = db.Column(db.Date, nullable=True)

    # Labels stored as JSONB array for lightweight sub-categorization
    # e.g., ["bug", "feature", "docs"]
    labels = db.Column(JSONB, nullable=True, default=list)

    estimated_hours = db.Column(db.Float, nullable=True)

    # Auto-set when moved to a done column, cleared when moved out
    completed_at = db.Column(db.DateTime, nullable=True)

    # Extensible data for future integrations (GitHub issue, PR URL, etc.)
    extra_data = db.Column(JSONB, nullable=True, default=dict)

    # Timestamps
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        db.Index('ix_project_tasks_project_id', 'project_id'),
        db.Index('ix_project_tasks_column_id', 'column_id'),
    )

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'project_id': self.project_id,
            'column_id': self.column_id,
            'title': self.title,
            'description_json': self.description_json,
            'description_text': self.description_text,
            'priority': self.priority,
            'sort_order': self.sort_order,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'labels': self.labels or [],
            'estimated_hours': self.estimated_hours,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'extra_data': self.extra_data or {},
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


# ── Changelog ────────────────────────────────────────────────────

class ProjectChangelog(db.Model):
    """A timeline entry for a project (milestone, release, feature, etc.)."""
    __tablename__ = 'project_changelog'

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    entry_type = db.Column(db.String(50), nullable=False)   # milestone, release, feature, fix, note, breaking_change
    title = db.Column(db.String(500), nullable=False)
    description = db.Column(db.Text, nullable=True)
    version = db.Column(db.String(50), nullable=True)        # e.g., "1.2.0" (optional)
    entry_date = db.Column(db.Date, nullable=False, default=lambda: date.today())

    # Extensible data for future integrations (commit SHA, PR number)
    extra_data = db.Column(JSONB, nullable=True, default=dict)

    # Timestamps
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        db.Index('ix_project_changelog_project_id', 'project_id'),
        db.Index('ix_project_changelog_entry_date', 'entry_date'),
    )

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'project_id': self.project_id,
            'entry_type': self.entry_type,
            'title': self.title,
            'description': self.description,
            'version': self.version,
            'entry_date': self.entry_date.isoformat() if self.entry_date else None,
            'extra_data': self.extra_data or {},
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
