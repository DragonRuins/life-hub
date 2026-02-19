"""
Infrastructure Integration Services

Contains the integration engine for connecting to Docker, HomeAssistant,
Portainer, and other infrastructure APIs. Each integration extends
BaseIntegration and is registered in the registry.

Sub-modules:
    base.py                    - Abstract base class for all integrations
    registry.py                - Maps integration type strings to classes
    docker_integration.py      - Docker socket/TCP API integration
    homeassistant_integration.py - HomeAssistant REST API integration
    portainer_integration.py   - Portainer API integration (stub)
    sync_worker.py             - Background sync loop for enabled integrations
    uptime_checker.py          - HTTP health checks for monitored services
"""
