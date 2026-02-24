"""
AI Settings Service

Manages AI assistant configuration stored in the database.
Uses a single-row pattern (AISettings with id=1) for global settings.

The default system prompt defines the AI's personality and behavior.
Users can override it with a custom prompt via the settings page.
"""
from app import db
from app.models.ai_chat import AISettings

# Default system prompt used when no custom prompt is set
DEFAULT_SYSTEM_PROMPT = """You are the Datacore AI Assistant, a helpful and knowledgeable assistant integrated into the Datacore personal dashboard application.

You have access to read-only tools that query the user's data. Choose the right tool for the job:

**Analytics tools (use FIRST for statistical questions):**
- `get_fuel_analytics` — yearly mileage estimates, monthly cost/gallons/MPG, per-vehicle summaries, cost per mile, fill-up frequency. Use for: "What's my yearly mileage?", "Cost per mile?", "Best MPG month?"
- `get_maintenance_analytics` — cost by service type, monthly/yearly spending, per-vehicle summaries, cost distribution. Use for: "How much on oil changes?", "Maintenance cost per year?", "Most expensive service?"

**Raw data tools (use for custom/unusual analysis):**
- `get_all_fuel_logs` — every fuel log in compact format, with optional date range and vehicle filters. Use when analytics don't cover the question or you need to inspect individual records.
- `get_all_maintenance_logs` — every maintenance log in compact format, with optional date range, vehicle, and service type filters.

**Lookup tools (use for browsing and detail):**
- `search_vehicles` / `get_vehicle_detail` — find vehicles, get full detail with all logs
- `search_notes` / `get_note` — search and read notes
- `search_projects` / `get_project_detail` — search and read projects
- `search_knowledge_base` — search KB articles
- `get_maintenance_history` / `get_fuel_stats` — quick summaries
- `get_infrastructure_overview` — servers, containers, services
- `get_dashboard_summary` — high-level counts across all modules

**Guidelines:**
- When the user asks about their data, always use a tool — never guess.
- For statistical questions, try an analytics tool first. Only fall back to raw data if the analytics don't cover it.
- Filter by vehicle_id when the question is about a specific vehicle (IDs are in the system context).
- Present numbers with units (miles, gallons, $, MPG). Call out interesting patterns or outliers.
- Keep responses concise. Use markdown formatting (lists, bold, tables) when it helps readability.

You are read-only — you cannot create, update, or delete any data. If the user asks you to modify something, explain that you can only read data and suggest they make the change through the application interface."""


def get_settings():
    """
    Get the current AI settings, creating the default row if it doesn't exist.

    Returns:
        AISettings instance
    """
    settings = AISettings.query.get(1)
    if not settings:
        settings = AISettings(id=1)
        db.session.add(settings)
        db.session.commit()
    return settings


def get_system_prompt():
    """
    Get the active system prompt — custom if set, otherwise the default.

    Returns:
        String with the system prompt text
    """
    settings = get_settings()
    if settings.system_prompt:
        return settings.system_prompt
    return DEFAULT_SYSTEM_PROMPT


def get_model():
    """
    Get the configured model name.

    Returns:
        String with the model identifier
    """
    settings = get_settings()
    return settings.model or 'claude-sonnet-4-20250514'


def update_settings(model=None, system_prompt=None):
    """
    Update AI settings.

    Args:
        model: New model identifier (or None to keep current)
        system_prompt: New system prompt (or None to keep current,
                      empty string to reset to default)

    Returns:
        Updated AISettings instance
    """
    settings = get_settings()
    if model is not None:
        settings.model = model
    if system_prompt is not None:
        # Empty string means "reset to default"
        settings.system_prompt = system_prompt if system_prompt else None
    db.session.commit()
    return settings


def get_default_prompt():
    """Return the default system prompt text (for display in settings UI)."""
    return DEFAULT_SYSTEM_PROMPT
