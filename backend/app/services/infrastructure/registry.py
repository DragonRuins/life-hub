"""
Integration Registry

Maps integration type strings (from InfraIntegrationConfig.integration_type)
to their corresponding Python classes. When the sync worker or route handler
needs to instantiate an integration, it calls get_integration_class(type_string).

New integration types are registered here.
"""
import logging

logger = logging.getLogger(__name__)

# Lazy imports to avoid circular dependencies — classes are imported on first use.
_registry = {}
_loaded = False


def _load_registry():
    """Import and register all integration classes (called once on first use)."""
    global _registry, _loaded
    if _loaded:
        return

    from app.services.infrastructure.docker_integration import DockerIntegration
    from app.services.infrastructure.homeassistant_integration import HomeAssistantIntegration
    from app.services.infrastructure.portainer_integration import PortainerIntegration

    _registry = {
        'docker': DockerIntegration,
        'homeassistant': HomeAssistantIntegration,
        'portainer': PortainerIntegration,
    }
    _loaded = True


def get_integration_class(integration_type):
    """
    Look up the integration class for a given type string.

    Args:
        integration_type: String like 'docker', 'homeassistant', 'portainer'.

    Returns:
        The class (subclass of BaseIntegration), or None if not found.
    """
    _load_registry()
    cls = _registry.get(integration_type)
    if not cls:
        logger.warning(f"Unknown integration type: '{integration_type}'")
    return cls


def get_all_schemas():
    """
    Return config schemas for all registered integration types.

    Returns:
        dict: { 'docker': {...schema...}, 'homeassistant': {...}, ... }
    """
    _load_registry()
    schemas = {}
    for type_name, cls in _registry.items():
        try:
            schemas[type_name] = cls.get_config_schema()
        except Exception as e:
            logger.error(f"Failed to get schema for '{type_name}': {e}")
    return schemas
