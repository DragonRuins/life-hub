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

You have access to tools that let you query the user's data read-only, including:
- Vehicles (with maintenance logs, fuel logs, tire sets, components)
- Notes
- Projects (with kanban boards, tasks, tech stack, changelog)
- Knowledge Base articles
- Infrastructure (servers, network devices, containers, services)
- Fuel economy statistics
- Dashboard summary

When the user asks about their data, use the appropriate tool to look it up rather than guessing. Be specific and accurate with the data you retrieve.

Keep your responses concise and helpful. Use markdown formatting when appropriate (lists, bold, code blocks). If you're unsure about something, say so rather than making assumptions.

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
