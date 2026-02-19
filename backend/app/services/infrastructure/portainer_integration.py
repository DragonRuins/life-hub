"""
Portainer Integration (Stub)

Placeholder for future Portainer API integration. Implements
test_connection() with basic HTTP check. Full sync() is not
yet implemented.
"""
import logging

import requests

from app.services.infrastructure.base import BaseIntegration

logger = logging.getLogger(__name__)


class PortainerIntegration(BaseIntegration):
    """
    Portainer API integration (stub).

    Config fields:
        url: Portainer URL (e.g., http://192.168.1.50:9443)
        api_key: Portainer API key
    """

    def test_connection(self):
        """
        Test connectivity by calling the Portainer /api/status endpoint.

        Returns:
            dict: {'success': True/False, 'message': '...'}
        """
        try:
            url = self.config.get('url', '').rstrip('/')
            api_key = self.config.get('api_key', '')

            if not url:
                return {'success': False, 'message': 'Portainer URL is not configured'}

            headers = {'X-API-Key': api_key} if api_key else {}
            resp = requests.get(f'{url}/api/status', headers=headers, timeout=10)

            if resp.status_code == 200:
                data = resp.json()
                version = data.get('Version', 'unknown')
                return {
                    'success': True,
                    'message': f'Connected to Portainer {version}',
                }
            elif resp.status_code == 401:
                return {
                    'success': False,
                    'message': 'Authentication failed. Check your API key.',
                }
            else:
                return {
                    'success': False,
                    'message': f'Unexpected response: HTTP {resp.status_code}',
                }
        except requests.exceptions.ConnectionError:
            return {
                'success': False,
                'message': 'Cannot connect to Portainer. Is it running?',
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'Connection failed: {str(e)}',
            }

    def sync(self):
        """
        Portainer sync is not yet implemented.

        Returns:
            dict: Stub response indicating not implemented.
        """
        return {
            'success': False,
            'message': 'Portainer sync is not yet implemented. Use Docker integration for container monitoring.',
        }

    @staticmethod
    def get_config_schema():
        """Return the Portainer integration config schema."""
        return {
            'type': 'portainer',
            'label': 'Portainer',
            'description': 'Connect to Portainer for container management (coming soon).',
            'fields': [
                {
                    'name': 'url',
                    'label': 'Portainer URL',
                    'type': 'text',
                    'default': 'https://portainer.local:9443',
                    'help': 'Full URL to your Portainer instance.',
                },
                {
                    'name': 'api_key',
                    'label': 'API Key',
                    'type': 'password',
                    'default': '',
                    'help': 'Portainer API key. Generate one in Settings > Access management.',
                },
            ],
        }
