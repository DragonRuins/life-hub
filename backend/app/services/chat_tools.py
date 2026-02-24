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
from datetime import date, datetime
from collections import defaultdict
from statistics import median
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
        {
            "name": "get_all_fuel_logs",
            "description": "Get ALL fuel logs in compact format for direct analysis. Use this when you need raw fuel data for custom calculations. Supports optional date range and vehicle filters.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "vehicle_id": {
                        "type": "integer",
                        "description": "Optional vehicle ID to filter logs"
                    },
                    "start_date": {
                        "type": "string",
                        "description": "Optional start date (YYYY-MM-DD) for date range filter"
                    },
                    "end_date": {
                        "type": "string",
                        "description": "Optional end date (YYYY-MM-DD) for date range filter"
                    }
                },
                "required": []
            }
        },
        {
            "name": "get_fuel_analytics",
            "description": "Get pre-computed fuel analytics: yearly mileage estimate, monthly cost/gallons/MPG breakdowns, per-vehicle summaries (total gallons, cost, avg/best/worst MPG, cost per mile), fill-up frequency, and fleet totals. Use this FIRST for statistical questions about fuel — it's more efficient than raw data.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "vehicle_id": {
                        "type": "integer",
                        "description": "Optional vehicle ID for single-vehicle analytics. Omit for fleet-wide."
                    }
                },
                "required": []
            }
        },
        {
            "name": "get_all_maintenance_logs",
            "description": "Get ALL maintenance logs in compact format for direct analysis. Supports optional date range, vehicle, and service type filters.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "vehicle_id": {
                        "type": "integer",
                        "description": "Optional vehicle ID to filter logs"
                    },
                    "start_date": {
                        "type": "string",
                        "description": "Optional start date (YYYY-MM-DD) for date range filter"
                    },
                    "end_date": {
                        "type": "string",
                        "description": "Optional end date (YYYY-MM-DD) for date range filter"
                    },
                    "service_type": {
                        "type": "string",
                        "description": "Optional partial-match filter on service type (e.g. 'oil' matches 'Oil Change')"
                    }
                },
                "required": []
            }
        },
        {
            "name": "get_maintenance_analytics",
            "description": "Get pre-computed maintenance analytics: cost by service type, monthly/yearly breakdowns, per-vehicle summaries, and cost distribution (min/max/median/avg). Use this FIRST for questions about maintenance spending or frequency.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "vehicle_id": {
                        "type": "integer",
                        "description": "Optional vehicle ID for single-vehicle analytics. Omit for fleet-wide."
                    }
                },
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
    vehicles = q.order_by(Vehicle.year.desc()).all()
    return [v.to_dict() for v in vehicles]


def _get_vehicle_detail(vehicle_id):
    """Get full vehicle details with related records."""
    vehicle = Vehicle.query.get(vehicle_id)
    if not vehicle:
        return {"error": f"Vehicle with ID {vehicle_id} not found"}

    result = vehicle.to_dict()
    # All maintenance logs in compact format (omit description, created_at)
    logs = (MaintenanceLog.query
            .filter_by(vehicle_id=vehicle_id)
            .order_by(MaintenanceLog.date.desc())
            .all())
    result['maintenance_logs'] = [{
        'id': l.id, 'date': l.date.isoformat() if l.date else None,
        'type': l.service_type, 'mileage': l.mileage,
        'cost': l.cost, 'shop': l.shop_name,
        'items': [i.name for i in l.items],
    } for l in logs]

    # All fuel logs in compact format (omit location, notes, payment_method)
    fuel = (FuelLog.query
            .filter_by(vehicle_id=vehicle_id)
            .order_by(FuelLog.date.desc())
            .all())
    result['fuel_logs'] = [{
        'id': f.id, 'date': f.date.isoformat() if f.date else None,
        'mileage': f.mileage, 'gallons': f.gallons_added,
        'cpg': f.cost_per_gallon, 'total_cost': f.total_cost,
        'mpg': f.mpg, 'missed_previous': f.missed_previous,
    } for f in fuel]

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
    notes = q.order_by(Note.updated_at.desc()).limit(100).all()
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
    projects = q.order_by(Project.sort_order).all()
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
                .limit(100)
                .all())
    return [a.to_dict(include_content=False) for a in articles]


def _get_maintenance_history(vehicle_id=None):
    """Get maintenance log history."""
    q = MaintenanceLog.query
    if vehicle_id:
        q = q.filter_by(vehicle_id=vehicle_id)
    logs = q.order_by(MaintenanceLog.date.desc()).all()
    return [log.to_dict() for log in logs]


def _get_fuel_stats(vehicle_id=None):
    """Get fuel economy statistics."""
    q = FuelLog.query
    if vehicle_id:
        q = q.filter_by(vehicle_id=vehicle_id)

    fuel_logs = q.order_by(FuelLog.date.desc()).all()

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


def _get_all_fuel_logs(vehicle_id=None, start_date=None, end_date=None):
    """Return ALL fuel logs in compact format for AI analysis."""
    q = FuelLog.query
    if vehicle_id:
        q = q.filter_by(vehicle_id=vehicle_id)

    # Apply optional date filters (silently ignore invalid dates)
    if start_date:
        try:
            q = q.filter(FuelLog.date >= date.fromisoformat(start_date))
        except ValueError:
            pass
    if end_date:
        try:
            q = q.filter(FuelLog.date <= date.fromisoformat(end_date))
        except ValueError:
            pass

    fuel_logs = q.order_by(FuelLog.date.asc()).all()

    if not fuel_logs:
        return {"total": 0, "logs": []}

    # Build vehicle name map for context
    vehicle_ids = set(f.vehicle_id for f in fuel_logs)
    vehicles = Vehicle.query.filter(Vehicle.id.in_(vehicle_ids)).all()
    vehicle_map = {v.id: f"{v.year} {v.make} {v.model}" for v in vehicles}

    # Compact log format to minimize tokens
    logs = [{
        'id': f.id, 'vid': f.vehicle_id,
        'd': f.date.isoformat() if f.date else None,
        'mi': f.mileage, 'gal': f.gallons_added,
        'cpg': f.cost_per_gallon, 'tc': f.total_cost,
        'mpg': f.mpg, 'skip': f.missed_previous or False,
    } for f in fuel_logs]

    return {
        "total": len(logs),
        "vehicles": vehicle_map,
        "date_range": {
            "earliest": fuel_logs[0].date.isoformat() if fuel_logs[0].date else None,
            "latest": fuel_logs[-1].date.isoformat() if fuel_logs[-1].date else None,
        },
        "field_key": "id, vid=vehicle_id, d=date, mi=mileage, gal=gallons, cpg=cost_per_gallon, tc=total_cost, mpg, skip=missed_previous",
        "logs": logs,
    }


def _get_fuel_analytics(vehicle_id=None):
    """Pre-compute fuel analytics so the AI doesn't need raw data for common questions."""
    q = FuelLog.query
    if vehicle_id:
        q = q.filter_by(vehicle_id=vehicle_id)

    fuel_logs = q.order_by(FuelLog.date.asc()).all()

    if not fuel_logs:
        return {"message": "No fuel logs found"}

    # Build vehicle name map
    vehicle_ids = set(f.vehicle_id for f in fuel_logs)
    vehicles = Vehicle.query.filter(Vehicle.id.in_(vehicle_ids)).all()
    vehicle_map = {v.id: f"{v.year} {v.make} {v.model}" for v in vehicles}

    result = {
        "total_logs": len(fuel_logs),
        "vehicles": vehicle_map,
    }

    # ── Per-vehicle summaries ──
    by_vehicle = defaultdict(list)
    for f in fuel_logs:
        by_vehicle[f.vehicle_id].append(f)

    per_vehicle = {}
    yearly_mileage_estimates = {}

    for vid, logs in by_vehicle.items():
        gallons = sum(f.gallons_added or 0 for f in logs)
        cost = sum(f.total_cost or 0 for f in logs)
        mpg_vals = [f.mpg for f in logs if f.mpg and not f.missed_previous]
        cpg_vals = [f.cost_per_gallon for f in logs if f.cost_per_gallon]

        summary = {
            "name": vehicle_map.get(vid, f"Vehicle {vid}"),
            "log_count": len(logs),
            "total_gallons": round(gallons, 2),
            "total_cost": round(cost, 2),
            "avg_cost_per_gallon": round(sum(cpg_vals) / len(cpg_vals), 3) if cpg_vals else None,
        }

        if mpg_vals:
            summary["avg_mpg"] = round(sum(mpg_vals) / len(mpg_vals), 1)
            summary["best_mpg"] = round(max(mpg_vals), 1)
            summary["worst_mpg"] = round(min(mpg_vals), 1)

        # Cost per mile: total_cost / total miles driven
        # Total miles = last odometer - first odometer
        sorted_logs = sorted(logs, key=lambda f: (f.date or date.min, f.mileage or 0))
        if len(sorted_logs) >= 2:
            first_mi = sorted_logs[0].mileage or 0
            last_mi = sorted_logs[-1].mileage or 0
            total_miles = last_mi - first_mi
            if total_miles > 0:
                summary["total_miles_tracked"] = total_miles
                summary["cost_per_mile"] = round(cost / total_miles, 3)

                # Yearly mileage estimate
                first_date = sorted_logs[0].date
                last_date = sorted_logs[-1].date
                if first_date and last_date and first_date != last_date:
                    days_span = (last_date - first_date).days
                    if days_span > 0:
                        yearly_est = round(total_miles / (days_span / 365.25))
                        summary["yearly_mileage_estimate"] = yearly_est
                        yearly_mileage_estimates[vid] = yearly_est

        # Fill-up frequency (days between fill-ups)
        dates = sorted([f.date for f in logs if f.date])
        if len(dates) >= 2:
            gaps = [(dates[i+1] - dates[i]).days for i in range(len(dates) - 1)]
            gaps = [g for g in gaps if g > 0]  # filter same-day fills
            if gaps:
                summary["fillup_frequency"] = {
                    "avg_days": round(sum(gaps) / len(gaps), 1),
                    "min_days": min(gaps),
                    "max_days": max(gaps),
                }

        per_vehicle[vid] = summary

    result["per_vehicle"] = per_vehicle
    result["yearly_mileage_estimates"] = {
        vehicle_map.get(vid, f"Vehicle {vid}"): est
        for vid, est in yearly_mileage_estimates.items()
    }

    # ── Monthly breakdown (all vehicles combined) ──
    monthly = defaultdict(lambda: {"gallons": 0, "cost": 0, "count": 0, "mpg_vals": []})
    for f in fuel_logs:
        if f.date:
            key = f.date.strftime("%Y-%m")
            monthly[key]["gallons"] += f.gallons_added or 0
            monthly[key]["cost"] += f.total_cost or 0
            monthly[key]["count"] += 1
            if f.mpg and not f.missed_previous:
                monthly[key]["mpg_vals"].append(f.mpg)

    result["monthly_breakdown"] = {
        k: {
            "gallons": round(v["gallons"], 2),
            "cost": round(v["cost"], 2),
            "fillups": v["count"],
            "avg_mpg": round(sum(v["mpg_vals"]) / len(v["mpg_vals"]), 1) if v["mpg_vals"] else None,
        }
        for k, v in sorted(monthly.items())
    }

    # ── Calendar year breakdown ──
    yearly = defaultdict(lambda: {"gallons": 0, "cost": 0, "count": 0, "miles_by_vehicle": defaultdict(list)})
    for f in fuel_logs:
        if f.date:
            year = str(f.date.year)
            yearly[year]["gallons"] += f.gallons_added or 0
            yearly[year]["cost"] += f.total_cost or 0
            yearly[year]["count"] += 1
            if f.mileage:
                yearly[year]["miles_by_vehicle"][f.vehicle_id].append(f.mileage)

    year_summary = {}
    for year, data in sorted(yearly.items()):
        entry = {
            "gallons": round(data["gallons"], 2),
            "cost": round(data["cost"], 2),
            "fillups": data["count"],
        }
        # Calculate miles tracked per year (max - min odometer per vehicle)
        total_year_miles = 0
        for vid, mileages in data["miles_by_vehicle"].items():
            if len(mileages) >= 2:
                total_year_miles += max(mileages) - min(mileages)
        if total_year_miles > 0:
            entry["miles_tracked"] = total_year_miles
        year_summary[year] = entry
    result["yearly_breakdown"] = year_summary

    # ── Fleet totals ──
    total_gallons = sum(f.gallons_added or 0 for f in fuel_logs)
    total_cost = sum(f.total_cost or 0 for f in fuel_logs)
    all_mpg = [f.mpg for f in fuel_logs if f.mpg and not f.missed_previous]
    result["fleet_summary"] = {
        "total_gallons": round(total_gallons, 2),
        "total_cost": round(total_cost, 2),
        "avg_mpg": round(sum(all_mpg) / len(all_mpg), 1) if all_mpg else None,
        "vehicle_count": len(by_vehicle),
        "total_fillups": len(fuel_logs),
    }

    return result


def _get_all_maintenance_logs(vehicle_id=None, start_date=None, end_date=None, service_type=None):
    """Return ALL maintenance logs in compact format for AI analysis."""
    q = MaintenanceLog.query
    if vehicle_id:
        q = q.filter_by(vehicle_id=vehicle_id)
    if service_type:
        q = q.filter(MaintenanceLog.service_type.ilike(f"%{service_type}%"))

    # Apply optional date filters
    if start_date:
        try:
            q = q.filter(MaintenanceLog.date >= date.fromisoformat(start_date))
        except ValueError:
            pass
    if end_date:
        try:
            q = q.filter(MaintenanceLog.date <= date.fromisoformat(end_date))
        except ValueError:
            pass

    logs = q.order_by(MaintenanceLog.date.asc()).all()

    if not logs:
        return {"total": 0, "logs": []}

    # Build vehicle name map
    vehicle_ids = set(l.vehicle_id for l in logs)
    vehicles = Vehicle.query.filter(Vehicle.id.in_(vehicle_ids)).all()
    vehicle_map = {v.id: f"{v.year} {v.make} {v.model}" for v in vehicles}

    compact = [{
        'id': l.id, 'vid': l.vehicle_id,
        'd': l.date.isoformat() if l.date else None,
        'type': l.service_type, 'mi': l.mileage,
        'cost': l.cost, 'shop': l.shop_name,
        'items': [i.name for i in l.items],
    } for l in logs]

    return {
        "total": len(compact),
        "vehicles": vehicle_map,
        "date_range": {
            "earliest": logs[0].date.isoformat() if logs[0].date else None,
            "latest": logs[-1].date.isoformat() if logs[-1].date else None,
        },
        "field_key": "id, vid=vehicle_id, d=date, type=service_type, mi=mileage, cost, shop, items",
        "logs": compact,
    }


def _get_maintenance_analytics(vehicle_id=None):
    """Pre-compute maintenance analytics for common questions."""
    q = MaintenanceLog.query
    if vehicle_id:
        q = q.filter_by(vehicle_id=vehicle_id)

    logs = q.order_by(MaintenanceLog.date.asc()).all()

    if not logs:
        return {"message": "No maintenance logs found"}

    # Build vehicle name map
    vehicle_ids = set(l.vehicle_id for l in logs)
    vehicles = Vehicle.query.filter(Vehicle.id.in_(vehicle_ids)).all()
    vehicle_map = {v.id: f"{v.year} {v.make} {v.model}" for v in vehicles}

    result = {
        "total_logs": len(logs),
        "vehicles": vehicle_map,
    }

    # ── Cost by service type ──
    by_type = defaultdict(lambda: {"count": 0, "total_cost": 0, "dates": []})
    for l in logs:
        st = l.service_type or "Unknown"
        by_type[st]["count"] += 1
        by_type[st]["total_cost"] += l.cost or 0
        if l.date:
            by_type[st]["dates"].append(l.date)

    type_summary = {}
    for st, data in sorted(by_type.items(), key=lambda x: x[1]["total_cost"], reverse=True):
        entry = {
            "count": data["count"],
            "total_cost": round(data["total_cost"], 2),
            "avg_cost": round(data["total_cost"] / data["count"], 2) if data["count"] > 0 else 0,
        }
        # Average days between occurrences of this service type
        dates_sorted = sorted(data["dates"])
        if len(dates_sorted) >= 2:
            gaps = [(dates_sorted[i+1] - dates_sorted[i]).days for i in range(len(dates_sorted) - 1)]
            gaps = [g for g in gaps if g > 0]
            if gaps:
                entry["avg_days_between"] = round(sum(gaps) / len(gaps), 0)
        type_summary[st] = entry
    result["by_service_type"] = type_summary

    # ── Monthly breakdown ──
    monthly = defaultdict(lambda: {"cost": 0, "count": 0, "types": set()})
    for l in logs:
        if l.date:
            key = l.date.strftime("%Y-%m")
            monthly[key]["cost"] += l.cost or 0
            monthly[key]["count"] += 1
            if l.service_type:
                monthly[key]["types"].add(l.service_type)

    result["monthly_breakdown"] = {
        k: {
            "cost": round(v["cost"], 2),
            "services": v["count"],
            "types": list(v["types"]),
        }
        for k, v in sorted(monthly.items())
    }

    # ── Yearly breakdown ──
    yearly = defaultdict(lambda: {"cost": 0, "count": 0})
    for l in logs:
        if l.date:
            year = str(l.date.year)
            yearly[year]["cost"] += l.cost or 0
            yearly[year]["count"] += 1

    result["yearly_breakdown"] = {
        k: {"cost": round(v["cost"], 2), "services": v["count"]}
        for k, v in sorted(yearly.items())
    }

    # ── Per-vehicle summary ──
    by_vehicle = defaultdict(list)
    for l in logs:
        by_vehicle[l.vehicle_id].append(l)

    per_vehicle = {}
    for vid, vlogs in by_vehicle.items():
        total_cost = sum(l.cost or 0 for l in vlogs)
        types = set(l.service_type for l in vlogs if l.service_type)
        most_recent = max((l.date for l in vlogs if l.date), default=None)
        per_vehicle[vid] = {
            "name": vehicle_map.get(vid, f"Vehicle {vid}"),
            "log_count": len(vlogs),
            "total_cost": round(total_cost, 2),
            "unique_service_types": list(types),
            "most_recent_service": most_recent.isoformat() if most_recent else None,
        }
    result["per_vehicle"] = per_vehicle

    # ── Cost distribution across all logs ──
    costs = [l.cost for l in logs if l.cost is not None and l.cost > 0]
    if costs:
        result["cost_distribution"] = {
            "min": round(min(costs), 2),
            "max": round(max(costs), 2),
            "median": round(median(costs), 2),
            "avg": round(sum(costs) / len(costs), 2),
            "total": round(sum(costs), 2),
        }

    return result


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
    "get_all_fuel_logs": lambda inp: _get_all_fuel_logs(
        inp.get("vehicle_id"), inp.get("start_date"), inp.get("end_date")),
    "get_fuel_analytics": lambda inp: _get_fuel_analytics(inp.get("vehicle_id")),
    "get_all_maintenance_logs": lambda inp: _get_all_maintenance_logs(
        inp.get("vehicle_id"), inp.get("start_date"), inp.get("end_date"), inp.get("service_type")),
    "get_maintenance_analytics": lambda inp: _get_maintenance_analytics(inp.get("vehicle_id")),
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

        # Per-vehicle detail with IDs and log counts so AI can target tools
        vehicle_lines = []
        for v in vehicles:
            fuel_count = FuelLog.query.filter_by(vehicle_id=v.id).count()
            maint_count = MaintenanceLog.query.filter_by(vehicle_id=v.id).count()
            vehicle_lines.append(
                f"  - {v.year} {v.make} {v.model} (ID: {v.id}, mileage: {v.current_mileage or 'unknown'}, "
                f"fuel logs: {fuel_count}, maintenance logs: {maint_count})"
            )
        vehicle_section = "\n".join(vehicle_lines) if vehicle_lines else "  (none)"

        projects = Project.query.filter_by(status='active').all()
        project_list = ", ".join(p.name for p in projects) if projects else "none"

        lines = [
            "Database overview:",
            f"- Vehicles ({summary['vehicles']}):",
            vehicle_section,
            f"- Notes: {summary['notes']}",
            f"- Projects ({summary['projects']} total, {summary['active_projects']} active): {project_list}",
            f"- Knowledge Base articles: {summary['knowledge_base_articles']}",
            f"- Infrastructure hosts: {summary['infrastructure_hosts']}, monitored services: {summary['monitored_services']}",
            f"- Total maintenance logs: {summary['maintenance_logs']}, total fuel logs: {summary['fuel_logs']}",
        ]
        return "\n".join(lines)
    except Exception as e:
        return f"(Could not build context summary: {str(e)})"
