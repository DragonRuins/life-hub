"""
Base Integration - Abstract class for infrastructure integrations.

All integrations (Docker, HomeAssistant, Portainer, etc.) extend this
class and implement sync(), test_connection(), and get_config_schema().

The integration engine loads enabled InfraIntegrationConfig records,
looks up the matching class in the registry, and calls sync() on a
background schedule.
"""
import logging
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class BaseIntegration(ABC):
    """
    Abstract base class for infrastructure integrations.

    Each integration type (docker, homeassistant, portainer) extends this
    class. An instance is created per InfraIntegrationConfig record,
    receiving the config dict and host_id.

    Attributes:
        config_record: The InfraIntegrationConfig SQLAlchemy model instance.
        config: The config dict from the record (contains connection params).
        host_id: The associated host ID (if any).
        name: Human-readable name of this integration instance.
    """

    def __init__(self, config_record):
        """
        Initialize with an InfraIntegrationConfig model instance.

        Args:
            config_record: InfraIntegrationConfig instance from the database.
        """
        self.config_record = config_record
        self.config = config_record.config or {}
        self.host_id = config_record.host_id
        self.name = config_record.name

    @abstractmethod
    def sync(self):
        """
        Pull data from the remote system and update the database.

        Should upsert containers/services/metrics as appropriate.
        Returns a dict with sync results (e.g., counts of items synced).

        Raises:
            Exception: If the sync fails for any reason.
        """
        pass

    @abstractmethod
    def test_connection(self):
        """
        Test that the integration can connect to the remote system.

        Returns:
            dict: {'success': True/False, 'message': 'description'}
        """
        pass

    @staticmethod
    @abstractmethod
    def get_config_schema():
        """
        Return the configuration schema for this integration type.

        Used by the frontend to render dynamic config forms.

        Returns:
            dict: {
                'type': 'docker',
                'label': 'Docker',
                'description': 'Connect to Docker daemon',
                'fields': [
                    {'name': 'socket_path', 'label': 'Socket Path', 'type': 'text',
                     'default': '/var/run/docker.sock', 'help': 'Path to Docker socket'},
                    ...
                ]
            }
        """
        pass
