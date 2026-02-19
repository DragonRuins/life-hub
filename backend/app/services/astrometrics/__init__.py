"""
Astrometrics Services

Contains the external API client, cache manager, sync worker, and
ISS pass prediction calculator for the Astrometrics module.

Sub-modules:
    api_client.py    - Resilient HTTP client for NASA, Open Notify, Launch Library 2
    cache_manager.py - Cache-first data access with stale fallback
    sync_worker.py   - Background sync worker (called by APScheduler)
    iss_passes.py    - Skyfield-based ISS visible pass predictions
"""
