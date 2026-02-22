"""
HomeAssistant WebSocket Client

Connects to the HA WebSocket API for real-time state change events.
Runs in a daemon background thread so it doesn't block Flask.

On each state_changed event:
  - Updates the matching InfraSmarthomeDevice's cached state in the DB
  - Runs printer state transition logic if the device is a printer entity
  - Broadcasts the event to all SSE subscriber queues

Auto-reconnects with exponential backoff (2s -> 4s -> 8s -> ... max 60s).
"""
import json
import logging
import queue
import threading
import time
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class HAWebSocketClient:
    """
    Background WebSocket client that subscribes to HA state_changed events.

    Usage:
        ws_client = HAWebSocketClient(app)
        ws_client.start()     # launches daemon thread

    SSE endpoints call:
        q = ws_client.subscribe()     # get a queue
        ...yield from q...
        ws_client.unsubscribe(q)      # cleanup
    """

    def __init__(self, app):
        self._app = app
        self._thread = None
        self._running = False
        # All SSE subscriber queues — each gets a copy of every event
        self._subscribers = []
        self._subscribers_lock = threading.Lock()
        # Message ID counter for the HA WebSocket protocol
        self._msg_id = 0

    def start(self):
        """Start the WebSocket listener in a daemon thread."""
        if self._thread and self._thread.is_alive():
            return
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        logger.info("HA WebSocket client thread started")

    def stop(self):
        """Signal the thread to stop (best-effort)."""
        self._running = False

    def subscribe(self):
        """
        Create a new SSE subscriber queue.
        Returns a queue.Queue that will receive event dicts.
        """
        q = queue.Queue(maxsize=100)
        with self._subscribers_lock:
            self._subscribers.append(q)
        return q

    def unsubscribe(self, q):
        """Remove an SSE subscriber queue."""
        with self._subscribers_lock:
            try:
                self._subscribers.remove(q)
            except ValueError:
                pass

    def _broadcast(self, event_data):
        """Push an event dict to all subscriber queues."""
        with self._subscribers_lock:
            dead = []
            for q in self._subscribers:
                try:
                    q.put_nowait(event_data)
                except queue.Full:
                    # Slow consumer — drop oldest and push new
                    try:
                        q.get_nowait()
                        q.put_nowait(event_data)
                    except (queue.Empty, queue.Full):
                        dead.append(q)
            # Remove broken queues
            for q in dead:
                try:
                    self._subscribers.remove(q)
                except ValueError:
                    pass

    def _next_id(self):
        """Get the next message ID for the HA WS protocol."""
        self._msg_id += 1
        return self._msg_id

    def _run_loop(self):
        """
        Main reconnect loop. Connects, authenticates, subscribes,
        and processes events. On failure, backs off and retries.
        """
        backoff = 2
        max_backoff = 60

        while self._running:
            try:
                self._connect_and_listen()
                # If _connect_and_listen returns normally, reset backoff
                backoff = 2
            except Exception as e:
                logger.warning(f"HA WebSocket error: {e}")

            if not self._running:
                break

            logger.info(f"HA WebSocket reconnecting in {backoff}s...")
            time.sleep(backoff)
            backoff = min(backoff * 2, max_backoff)

    def _get_ha_config(self):
        """
        Read the HA integration URL and token from the database.
        Returns (ws_url, token) or (None, None) if not configured.
        """
        with self._app.app_context():
            from app.models.infrastructure import InfraIntegrationConfig

            integration = InfraIntegrationConfig.query.filter_by(
                integration_type='homeassistant',
                is_enabled=True,
            ).first()

            if not integration:
                return None, None

            config = integration.config or {}
            base_url = config.get('url', '').rstrip('/')
            token = config.get('token', '')

            if not base_url or not token:
                return None, None

            # Convert http(s) URL to ws(s) URL
            ws_url = base_url.replace('https://', 'wss://').replace('http://', 'ws://')
            ws_url += '/api/websocket'

            return ws_url, token

    def _connect_and_listen(self):
        """
        Single connection lifecycle: connect, auth, subscribe, read events.
        Uses the synchronous websockets API (no asyncio needed).
        """
        from websockets.sync.client import connect

        ws_url, token = self._get_ha_config()
        if not ws_url or not token:
            logger.debug("HA WebSocket: no HA integration configured, sleeping 30s")
            time.sleep(30)
            return

        # Connect with a 10-second timeout
        with connect(ws_url, open_timeout=10, close_timeout=5) as ws:
            # Step 1: Receive auth_required message
            msg = json.loads(ws.recv(timeout=10))
            if msg.get('type') != 'auth_required':
                raise RuntimeError(f"Expected auth_required, got {msg.get('type')}")

            # Step 2: Send auth
            ws.send(json.dumps({
                'type': 'auth',
                'access_token': token,
            }))

            # Step 3: Receive auth_ok or auth_invalid
            msg = json.loads(ws.recv(timeout=10))
            if msg.get('type') == 'auth_invalid':
                raise RuntimeError(f"HA auth failed: {msg.get('message')}")
            if msg.get('type') != 'auth_ok':
                raise RuntimeError(f"Expected auth_ok, got {msg.get('type')}")

            logger.info("HA WebSocket connected and authenticated")

            # Step 4: Subscribe to state_changed events
            sub_id = self._next_id()
            ws.send(json.dumps({
                'id': sub_id,
                'type': 'subscribe_events',
                'event_type': 'state_changed',
            }))

            # Read the subscription confirmation
            msg = json.loads(ws.recv(timeout=10))
            if msg.get('type') != 'result' or not msg.get('success'):
                raise RuntimeError(f"Subscribe failed: {msg}")

            logger.info("HA WebSocket subscribed to state_changed events")

            # Step 5: Read events until disconnected or stopped
            while self._running:
                try:
                    raw = ws.recv(timeout=30)
                except TimeoutError:
                    # No message in 30s — that's fine, just loop and check _running
                    continue

                msg = json.loads(raw)
                if msg.get('type') != 'event':
                    continue

                event = msg.get('event', {})
                if event.get('event_type') != 'state_changed':
                    continue

                event_data = event.get('data', {})
                self._handle_state_changed(event_data)

    def _handle_state_changed(self, event_data):
        """
        Process a state_changed event from HA.
        Updates the device in the DB and broadcasts to SSE subscribers.
        """
        new_state = event_data.get('new_state')
        if not new_state:
            return

        entity_id = new_state.get('entity_id')
        if not entity_id:
            return

        state_val = new_state.get('state')
        attributes = new_state.get('attributes', {})

        # Broadcast to SSE subscribers (always, even if device not in DB)
        sse_event = {
            'type': 'state_changed',
            'entity_id': entity_id,
            'state': state_val,
            'attributes': attributes,
            'last_changed': new_state.get('last_changed'),
        }

        try:
            with self._app.app_context():
                from app import db
                from app.models.infrastructure import InfraSmarthomeDevice

                device = InfraSmarthomeDevice.query.filter_by(
                    entity_id=entity_id
                ).first()

                if device:
                    old_state = device.last_state
                    now = datetime.now(timezone.utc)

                    device.last_state = state_val
                    device.last_attributes = attributes
                    device.last_updated_at = now

                    # Add device_id to SSE event for frontend matching
                    sse_event['device_id'] = device.id
                    sse_event['friendly_name'] = device.friendly_name

                    # Run printer state transition logic if applicable
                    if device.category == 'printer':
                        self._handle_printer_state_change(
                            db, device, old_state, state_val, now
                        )

                    try:
                        db.session.commit()
                    except Exception as e:
                        logger.error(f"HA WS commit failed for {entity_id}: {e}")
                        db.session.rollback()
        except Exception as e:
            logger.error(f"HA WS state update failed for {entity_id}: {e}")

        # Broadcast after DB update so SSE consumers get fresh data
        self._broadcast(sse_event)

    def _handle_printer_state_change(self, db, device, old_state, new_state, now):
        """
        Detect printer state transitions for job lifecycle management.
        Mirrors the logic from smarthome_poller._handle_printer_state but
        operates on a single entity rather than the full HA states dict.
        """
        from app.models.infrastructure import InfraPrinterJob

        printing_states = ('printing', 'running', 'busy')
        idle_states = ('idle', 'standby', 'ready', 'operational', 'offline', 'off')
        error_states = ('error', 'failed', 'paused')

        old_is_printing = old_state and old_state.lower() in printing_states
        new_is_printing = new_state and new_state.lower() in printing_states
        new_is_idle = new_state and new_state.lower() in idle_states
        new_is_error = new_state and new_state.lower() in error_states

        active_job = InfraPrinterJob.query.filter_by(
            device_id=device.id, status='printing'
        ).first()

        # idle -> printing: create new job
        if not old_is_printing and new_is_printing and not active_job:
            attrs = device.last_attributes or {}
            job = InfraPrinterJob(
                device_id=device.id,
                file_name=attrs.get('friendly_name'),
                status='printing',
                progress=0.0,
                started_at=now,
            )
            db.session.add(job)

        # printing -> idle: complete job
        elif old_is_printing and new_is_idle and active_job:
            active_job.status = 'completed'
            active_job.completed_at = now
            if active_job.started_at:
                active_job.duration_seconds = int((now - active_job.started_at).total_seconds())

        # printing -> error: fail job
        elif old_is_printing and new_is_error and active_job:
            active_job.status = 'failed'
            active_job.completed_at = now
            if active_job.started_at:
                active_job.duration_seconds = int((now - active_job.started_at).total_seconds())
