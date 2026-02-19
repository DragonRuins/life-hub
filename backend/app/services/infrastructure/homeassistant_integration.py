"""
HomeAssistant Integration

Connects to a HomeAssistant instance via its REST API using a
long-lived access token. Pulls entity states and records sensor
readings to infra_metrics.

Phase 2: Implements test_connection() and basic sync() for entity states.
Phase 3: Full sensor-to-metric mapping, smart home device overview.
"""
import logging
from datetime import datetime, timezone

import requests

from app.services.infrastructure.base import BaseIntegration

logger = logging.getLogger(__name__)


class HomeAssistantIntegration(BaseIntegration):
    """
    HomeAssistant REST API integration.

    Config fields:
        url: HomeAssistant URL (e.g., http://192.168.1.50:8123)
        token: Long-lived access token
        entity_filter: Optional list of entity IDs to sync (empty = all)
        sync_sensors: Whether to record sensor values as metrics
    """

    def _get_headers(self):
        """Build HTTP headers with the HA bearer token."""
        token = self.config.get('token', '')
        return {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
        }

    def _get_base_url(self):
        """Get the HA base URL, stripping trailing slashes."""
        url = self.config.get('url', '').rstrip('/')
        if not url:
            raise ValueError('HomeAssistant URL is not configured')
        return url

    def test_connection(self):
        """
        Test connectivity by calling the HA /api/ endpoint.

        Returns:
            dict: {'success': True/False, 'message': '...'}
        """
        try:
            url = self._get_base_url()
            resp = requests.get(
                f'{url}/api/',
                headers=self._get_headers(),
                timeout=10,
            )

            if resp.status_code == 200:
                data = resp.json()
                return {
                    'success': True,
                    'message': data.get('message', 'Connected to HomeAssistant'),
                }
            elif resp.status_code == 401:
                return {
                    'success': False,
                    'message': 'Authentication failed. Check your long-lived access token.',
                }
            else:
                return {
                    'success': False,
                    'message': f'Unexpected response: HTTP {resp.status_code}',
                }
        except requests.exceptions.ConnectionError:
            return {
                'success': False,
                'message': f'Cannot connect to HomeAssistant. Is it running?',
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'Connection failed: {str(e)}',
            }

    def sync(self):
        """
        Pull entity states from HomeAssistant and record sensor values
        as infra_metrics.

        Returns:
            dict: Sync results with counts.
        """
        from app import db
        from app.models.infrastructure import InfraMetric

        url = self._get_base_url()
        headers = self._get_headers()
        now = datetime.now(timezone.utc)

        # Fetch all states
        resp = requests.get(f'{url}/api/states', headers=headers, timeout=30)
        resp.raise_for_status()
        states = resp.json()

        # Optional entity filter
        entity_filter = self.config.get('entity_filter', [])
        if entity_filter:
            states = [s for s in states if s.get('entity_id') in entity_filter]

        sync_sensors = self.config.get('sync_sensors', True)
        metrics_count = 0

        if sync_sensors:
            for entity in states:
                entity_id = entity.get('entity_id', '')
                state_val = entity.get('state', '')

                # Only record numeric sensor values as metrics
                if not entity_id.startswith('sensor.'):
                    continue

                # Skip non-numeric states
                try:
                    value = float(state_val)
                except (ValueError, TypeError):
                    continue

                # Skip unavailable/unknown
                if state_val in ('unavailable', 'unknown'):
                    continue

                unit = entity.get('attributes', {}).get('unit_of_measurement', '')

                db.session.add(InfraMetric(
                    source_type='homeassistant',
                    source_id=self.config_record.id,  # Use integration config ID as source
                    metric_name=entity_id,
                    value=value,
                    unit=unit,
                    tags={'friendly_name': entity.get('attributes', {}).get('friendly_name', '')},
                    recorded_at=now,
                ))
                metrics_count += 1

        db.session.commit()

        return {
            'success': True,
            'total_entities': len(states),
            'metrics_recorded': metrics_count,
        }

    @staticmethod
    def get_config_schema():
        """Return the HomeAssistant integration config schema."""
        return {
            'type': 'homeassistant',
            'label': 'HomeAssistant',
            'description': 'Connect to HomeAssistant to pull sensor data and entity states.',
            'fields': [
                {
                    'name': 'url',
                    'label': 'HomeAssistant URL',
                    'type': 'text',
                    'default': 'http://homeassistant.local:8123',
                    'help': 'Full URL to your HomeAssistant instance.',
                },
                {
                    'name': 'token',
                    'label': 'Access Token',
                    'type': 'password',
                    'default': '',
                    'help': 'Long-lived access token. Create one in HA under Profile > Security.',
                },
                {
                    'name': 'sync_sensors',
                    'label': 'Sync Sensor Data',
                    'type': 'boolean',
                    'default': True,
                    'help': 'Record numeric sensor values as metrics on each sync.',
                },
                {
                    'name': 'entity_filter',
                    'label': 'Entity Filter (comma-separated)',
                    'type': 'textarea',
                    'default': '',
                    'help': 'Optional: comma-separated list of entity IDs to sync. Leave empty for all sensors.',
                },
            ],
        }
