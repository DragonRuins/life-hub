"""
AI Chat Tools Service

Defines Claude tool_use tools for read-only database queries.
Each tool maps to a function that queries SQLAlchemy models and
returns serialized results. All queries are read-only (no writes).

Exports:
  - get_tool_definitions(): list of tool schemas for the Anthropic API
  - execute_tool(name, input): dispatches to the correct handler
  - build_system_context(): generates a light summary for the system prompt
"""
import json
from app import db
from app.models.vehicle import Vehicle, MaintenanceLog, FuelLog
from app.models.note import Note
from app.models.project import Project, ProjectTask
from app.models.kb import KBArticle
from app.models.infrastructure import InfraHost, InfraNetworkDevice, InfraService, InfraContainer


# ── Tool Definitions (Anthropic API format) ─────────────────────────

def get_tool_definitions():
    """Return the list of tool schemas for the Anthropic API."""
    return [
        {
            "name": "search_vehicles",
            "description": "Search or list all vehicles. Returns basic vehicle info including year, make, model, trim, color, and mileage.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Optional search term to filter vehicles by make, model, or year"
                    }
                },
                "required": []
            }
        },
        {
            "name": "get_vehicle_detail",
            "description": "Get full details for a specific vehicle including recent maintenance logs, fuel logs, tire sets, and components.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "vehicle_id": {
                        "type": "integer",
                        "description": "The vehicle ID to look up"
                    }
                },
                "required": ["vehicle_id"]
            }
        },
        {
            "name": "search_notes",
            "description": "Search notes by title, content text, or tag. Returns matching notes with titles and snippets.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search term to match against note titles and content"
                    },
                    "folder_id": {
                        "type": "integer",
                        "description": "Optional folder ID to filter notes"
                    }
                },
                "required": ["query"]
            }
        },
        {
            "name": "get_note",
            "description": "Get a specific note with full content (plain text version).",
            "input_schema": {
                "type": "object",
                "properties": {
                    "note_id": {
                        "type": "integer",
                        "description": "The note ID to retrieve"
                    }
                },
                "required": ["note_id"]
            }
        },
        {
            "name": "search_projects",
            "description": "List or search projects. Returns project name, status, description, and task progress.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Optional search term to filter projects by name or description"
                    }
                },
                "required": []
            }
        },
        {
            "name": "get_project_detail",
            "description": "Get full project details including kanban columns with tasks, tech stack, and recent changelog entries.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "project_id": {
                        "type": "integer",
                        "description": "The project ID to look up"
                    }
                },
                "required": ["project_id"]
            }
        },
        {
            "name": "search_knowledge_base",
            "description": "Search knowledge base articles by title and content.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search term to match against article titles and content"
                    }
                },
                "required": ["query"]
            }
        },
        {
            "name": "get_maintenance_history",
            "description": "Get maintenance log history, optionally filtered by vehicle. Returns service type, date, mileage, cost, and notes.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "vehicle_id": {
                        "type": "integer",
                        "description": "Optional vehicle ID to filter maintenance logs"
                    }
                },
                "required": []
            }
        },
        {
            "name": "get_fuel_stats",
            "description": "Get fuel economy statistics including total gallons, total cost, average MPG, and recent fill-ups.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "vehicle_id": {
                        "type": "integer",
                        "description": "Optional vehicle ID to filter fuel stats"
                    }
                },
                "required": []
            }
        },
        {
            "name": "get_infrastructure_overview",
            "description": "Get an overview of infrastructure: servers/hosts, network devices, containers, and monitored services with their statuses.",
            "input_schema": {
                "type": "object",
                "properties": {},
                "required": []
            }
        },
        {
            "name": "get_dashboard_summary",
            "description": "Get a high-level summary of counts and statuses across all modules: vehicles, notes, projects, infrastructure, etc.",
            "input_schema": {
                "type": "object",
                "properties": {},
                "required": []
            }
        },
    ]


# ── Tool Handler Functions ──────────────────────────────────────────

def _search_vehicles(query=None):
    """Search/list vehicles with optional text filter."""
    q = Vehicle.query
    if query:
        term = f"%{query}%"
        q = q.filter(
            db.or_(
                Vehicle.make.ilike(term),
                Vehicle.model.ilike(term),
                Vehicle.year.cast(db.String).ilike(term),
                Vehicle.trim.ilike(term),
            )
        )
    vehicles = q.order_by(Vehicle.year.desc()).limit(50).all()
    return [v.to_dict() for v in vehicles]


def _get_vehicle_detail(vehicle_id):
    """Get full vehicle details with related records."""
    vehicle = Vehicle.query.get(vehicle_id)
    if not vehicle:
        return {"error": f"Vehicle with ID {vehicle_id} not found"}

    result = vehicle.to_dict()
    # Add recent maintenance logs (last 20)
    logs = (MaintenanceLog.query
            .filter_by(vehicle_id=vehicle_id)
            .order_by(MaintenanceLog.date.desc())
            .limit(20)
            .all())
    result['recent_maintenance'] = [log.to_dict() for log in logs]

    # Add recent fuel logs (last 20)
    fuel = (FuelLog.query
            .filter_by(vehicle_id=vehicle_id)
            .order_by(FuelLog.date.desc())
            .limit(20)
            .all())
    result['recent_fuel_logs'] = [f.to_dict() for f in fuel]

    # Tire sets and components are already included via to_dict relationships
    return result


def _search_notes(query, folder_id=None):
    """Search notes by title/content."""
    q = Note.query.filter_by(is_trashed=False)
    if folder_id:
        q = q.filter_by(folder_id=folder_id)

    term = f"%{query}%"
    q = q.filter(
        db.or_(
            Note.title.ilike(term),
            Note.content_text.ilike(term),
        )
    )
    notes = q.order_by(Note.updated_at.desc()).limit(50).all()
    # Return without full content to keep response size manageable
    return [n.to_dict(include_content=False) for n in notes]


def _get_note(note_id):
    """Get a specific note with plain text content."""
    note = Note.query.get(note_id)
    if not note:
        return {"error": f"Note with ID {note_id} not found"}
    result = {
        'id': note.id,
        'title': note.title,
        'content_text': note.content_text,
        'folder_id': note.folder_id,
        'is_starred': note.is_starred,
        'tags': [t.to_dict() for t in note.tags],
        'created_at': note.created_at.isoformat() if note.created_at else None,
        'updated_at': note.updated_at.isoformat() if note.updated_at else None,
    }
    return result


def _search_projects(query=None):
    """List/search projects."""
    q = Project.query
    if query:
        term = f"%{query}%"
        q = q.filter(
            db.or_(
                Project.name.ilike(term),
                Project.description.ilike(term),
            )
        )
    projects = q.order_by(Project.sort_order).limit(50).all()
    return [p.to_dict(include_details=False) for p in projects]


def _get_project_detail(project_id):
    """Get full project details with tasks, tech stack, changelog."""
    project = Project.query.get(project_id)
    if not project:
        return {"error": f"Project with ID {project_id} not found"}
    return project.to_dict(include_details=True)


def _search_knowledge_base(query):
    """Search KB articles by title and content."""
    term = f"%{query}%"
    articles = (KBArticle.query
                .filter(
                    db.or_(
                        KBArticle.title.ilike(term),
                        KBArticle.content_text.ilike(term),
                    )
                )
                .order_by(KBArticle.updated_at.desc())
                .limit(30)
                .all())
    return [a.to_dict(include_content=False) for a in articles]


def _get_maintenance_history(vehicle_id=None):
    """Get maintenance log history."""
    q = MaintenanceLog.query
    if vehicle_id:
        q = q.filter_by(vehicle_id=vehicle_id)
    logs = q.order_by(MaintenanceLog.date.desc()).limit(50).all()
    return [log.to_dict() for log in logs]


def _get_fuel_stats(vehicle_id=None):
    """Get fuel economy statistics."""
    q = FuelLog.query
    if vehicle_id:
        q = q.filter_by(vehicle_id=vehicle_id)

    fuel_logs = q.order_by(FuelLog.date.desc()).limit(50).all()

    if not fuel_logs:
        return {"message": "No fuel logs found", "logs": []}

    total_gallons = sum(f.gallons_added or 0 for f in fuel_logs)
    total_cost = sum(f.total_cost or 0 for f in fuel_logs)
    mpg_values = [f.mpg for f in fuel_logs if f.mpg]
    avg_mpg = sum(mpg_values) / len(mpg_values) if mpg_values else None

    return {
        "total_logs": len(fuel_logs),
        "total_gallons": round(total_gallons, 2),
        "total_cost": round(total_cost, 2),
        "average_mpg": round(avg_mpg, 1) if avg_mpg else None,
        "recent_logs": [f.to_dict() for f in fuel_logs[:10]],
    }


def _get_infrastructure_overview():
    """Get infrastructure summary."""
    hosts = InfraHost.query.all()
    network_devices = InfraNetworkDevice.query.all()
    containers = InfraContainer.query.all()
    services = InfraService.query.all()

    return {
        "hosts": [h.to_dict() for h in hosts],
        "network_devices": [n.to_dict() for n in network_devices],
        "container_count": len(containers),
        "containers_by_status": _count_by_field(containers, 'status'),
        "services": [s.to_dict() for s in services],
    }


def _count_by_field(items, field):
    """Helper to count items grouped by a field value."""
    counts = {}
    for item in items:
        val = getattr(item, field, 'unknown') or 'unknown'
        counts[val] = counts.get(val, 0) + 1
    return counts


def _get_dashboard_summary():
    """Get high-level counts across all modules."""
    vehicle_count = Vehicle.query.count()
    note_count = Note.query.filter_by(is_trashed=False).count()
    project_count = Project.query.count()
    active_projects = Project.query.filter_by(status='active').count()
    host_count = InfraHost.query.count()
    service_count = InfraService.query.count()
    kb_count = KBArticle.query.count()
    maintenance_count = MaintenanceLog.query.count()
    fuel_count = FuelLog.query.count()

    return {
        "vehicles": vehicle_count,
        "notes": note_count,
        "projects": project_count,
        "active_projects": active_projects,
        "infrastructure_hosts": host_count,
        "monitored_services": service_count,
        "knowledge_base_articles": kb_count,
        "maintenance_logs": maintenance_count,
        "fuel_logs": fuel_count,
    }


# ── Dispatcher ──────────────────────────────────────────────────────

# Map tool names to handler functions
_TOOL_HANDLERS = {
    "search_vehicles": lambda inp: _search_vehicles(inp.get("query")),
    "get_vehicle_detail": lambda inp: _get_vehicle_detail(inp["vehicle_id"]),
    "search_notes": lambda inp: _search_notes(inp["query"], inp.get("folder_id")),
    "get_note": lambda inp: _get_note(inp["note_id"]),
    "search_projects": lambda inp: _search_projects(inp.get("query")),
    "get_project_detail": lambda inp: _get_project_detail(inp["project_id"]),
    "search_knowledge_base": lambda inp: _search_knowledge_base(inp["query"]),
    "get_maintenance_history": lambda inp: _get_maintenance_history(inp.get("vehicle_id")),
    "get_fuel_stats": lambda inp: _get_fuel_stats(inp.get("vehicle_id")),
    "get_infrastructure_overview": lambda inp: _get_infrastructure_overview(),
    "get_dashboard_summary": lambda inp: _get_dashboard_summary(),
}


def execute_tool(tool_name, tool_input):
    """
    Dispatch a tool call to the correct handler function.

    Args:
        tool_name: Name of the tool to execute
        tool_input: Dict of input parameters

    Returns:
        Dict with the tool result data
    """
    handler = _TOOL_HANDLERS.get(tool_name)
    if not handler:
        return {"error": f"Unknown tool: {tool_name}"}

    try:
        return handler(tool_input)
    except Exception as e:
        return {"error": f"Tool execution failed: {str(e)}"}


def build_system_context():
    """
    Build a light summary of the application state for the system prompt.
    This gives the AI a snapshot of what data exists without loading everything.

    Returns:
        String with a human-readable summary
    """
    try:
        summary = _get_dashboard_summary()
        vehicles = Vehicle.query.order_by(Vehicle.year.desc()).all()
        vehicle_list = ", ".join(
            f"{v.year} {v.make} {v.model}" for v in vehicles
        ) if vehicles else "none"

        projects = Project.query.filter_by(status='active').all()
        project_list = ", ".join(p.name for p in projects) if projects else "none"

        lines = [
            f"Database overview:",
            f"- Vehicles ({summary['vehicles']}): {vehicle_list}",
            f"- Notes: {summary['notes']}",
            f"- Projects ({summary['projects']} total, {summary['active_projects']} active): {project_list}",
            f"- Knowledge Base articles: {summary['knowledge_base_articles']}",
            f"- Infrastructure hosts: {summary['infrastructure_hosts']}, monitored services: {summary['monitored_services']}",
            f"- Maintenance logs: {summary['maintenance_logs']}, fuel logs: {summary['fuel_logs']}",
        ]
        return "\n".join(lines)
    except Exception as e:
        return f"(Could not build context summary: {str(e)})"
