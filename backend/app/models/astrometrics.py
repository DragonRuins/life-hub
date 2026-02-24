"""
Astrometrics Module - Database Models

Defines tables for the space/astronomy data dashboard:
  - astro_cache: Cached API responses from NASA, Launch Library 2, etc.
  - astro_apod_favorites: User's saved APOD (Astronomy Picture of the Day) favorites
  - astro_settings: Singleton configuration (API keys, refresh intervals, thresholds)
  - astro_launch_notifications: Persistent dedup table for launch reminder scheduling

The module is read-only from a data perspective — all space data comes from
external APIs and is cached locally. The only user-created records are
APOD favorites and settings.
"""
from datetime import datetime, timezone
from app import db


class AstroCache(db.Model):
    """
    Cached API response from an external data source.

    Used by AstroCacheManager to implement a cache-first pattern:
    check DB for non-expired entry -> if fresh, return cached ->
    if expired or missing, call API -> store result -> return.

    The (source, cache_key) pair uniquely identifies a cached item.
    Examples:
      source='nasa_apod',   cache_key='2026-02-19'
      source='neo_feed',    cache_key='2026-02-17_2026-02-23'
      source='iss_position', cache_key='current'
      source='launches',    cache_key='upcoming'
    """
    __tablename__ = 'astro_cache'

    id = db.Column(db.Integer, primary_key=True)
    source = db.Column(db.String(50), nullable=False)       # e.g., 'nasa_apod', 'neo_feed', 'iss_position'
    cache_key = db.Column(db.String(255), nullable=False)    # e.g., '2026-02-19', 'current', 'upcoming'
    data = db.Column(db.JSON, nullable=False)                # The cached API response
    fetched_at = db.Column(db.DateTime, nullable=False,
                           default=lambda: datetime.now(timezone.utc))
    expires_at = db.Column(db.DateTime, nullable=False)      # When this cache entry expires

    __table_args__ = (
        db.UniqueConstraint('source', 'cache_key', name='uq_astro_cache_source_key'),
        db.Index('idx_astro_cache_expires', 'expires_at'),
    )

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'source': self.source,
            'cache_key': self.cache_key,
            'data': self.data,
            'fetched_at': self.fetched_at.isoformat() if self.fetched_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
        }


class AstroApodFavorite(db.Model):
    """
    A saved APOD (Astronomy Picture of the Day) favorite.

    Users can bookmark APOD entries they like. The full APOD metadata
    is stored so it doesn't need to be re-fetched from NASA later.
    The date field is unique since there's only one APOD per day.
    """
    __tablename__ = 'astro_apod_favorites'

    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.String(10), unique=True, nullable=False)   # YYYY-MM-DD format
    title = db.Column(db.String(500), nullable=False)
    url = db.Column(db.String(1000), nullable=False)               # Standard resolution URL
    hdurl = db.Column(db.String(1000))                             # High-resolution URL (images only)
    media_type = db.Column(db.String(20), nullable=False)          # 'image' or 'video'
    explanation = db.Column(db.Text)                               # NASA's description
    thumbnail_url = db.Column(db.String(1000))                     # Video thumbnail (videos only)
    copyright = db.Column(db.String(500))                          # Image credit/copyright
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'date': self.date,
            'title': self.title,
            'url': self.url,
            'hdurl': self.hdurl,
            'media_type': self.media_type,
            'explanation': self.explanation,
            'thumbnail_url': self.thumbnail_url,
            'copyright': self.copyright,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class AstroSettings(db.Model):
    """
    Singleton settings for the Astrometrics module.

    Uses the same pattern as NotificationSettings — a single row
    retrieved via the get_settings() classmethod. If no row exists,
    one is created with defaults.

    Stores the NASA API key, home location for ISS pass predictions,
    refresh intervals, and notification thresholds.
    """
    __tablename__ = 'astro_settings'

    id = db.Column(db.Integer, primary_key=True)

    # NASA API key (DEMO_KEY works but is rate-limited to 30 req/hour)
    nasa_api_key = db.Column(db.String(100), default='DEMO_KEY')

    # Home location for ISS pass predictions
    home_latitude = db.Column(db.Float, default=0.0)
    home_longitude = db.Column(db.Float, default=0.0)

    # Refresh intervals (in seconds) — how often the sync worker re-fetches
    refresh_apod = db.Column(db.Integer, default=86400)        # 24 hours
    refresh_neo = db.Column(db.Integer, default=21600)         # 6 hours
    refresh_iss_position = db.Column(db.Integer, default=15)   # 15 seconds (frontend polling)
    refresh_people_in_space = db.Column(db.Integer, default=3600)  # 1 hour
    refresh_launches = db.Column(db.Integer, default=3600)     # 1 hour

    # Notification thresholds
    launch_reminder_hours = db.Column(db.Integer, default=24)      # Gate 1: alert X hours before launch
    launch_reminder_minutes_2 = db.Column(db.Integer, nullable=True)  # Gate 2 (optional): alert X minutes before launch (null = disabled)
    neo_close_approach_threshold_ld = db.Column(db.Float, default=5.0)  # Alert if NEO within X lunar distances

    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    @classmethod
    def get_settings(cls):
        """
        Get the singleton settings row, creating it if it doesn't exist.

        Returns:
            AstroSettings: The settings instance
        """
        settings = cls.query.first()
        if not settings:
            settings = cls()
            db.session.add(settings)
            db.session.commit()
        return settings

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'nasa_api_key': self.nasa_api_key,
            'home_latitude': self.home_latitude,
            'home_longitude': self.home_longitude,
            'refresh_apod': self.refresh_apod,
            'refresh_neo': self.refresh_neo,
            'refresh_iss_position': self.refresh_iss_position,
            'refresh_people_in_space': self.refresh_people_in_space,
            'refresh_launches': self.refresh_launches,
            'launch_reminder_hours': self.launch_reminder_hours,
            'launch_reminder_minutes_2': self.launch_reminder_minutes_2,
            'neo_close_approach_threshold_ld': self.neo_close_approach_threshold_ld,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class AstroLaunchNotification(db.Model):
    """
    Persistent dedup table for launch reminder notifications.

    Each row represents a (launch_id, gate) pair. The sync worker creates
    a record and schedules an APScheduler one-shot job at the exact
    fire_at time. When the job fires, it marks the record as 'sent'.

    This replaces the in-memory sets (_notified_launches, _notified_inflight)
    so dedup survives container restarts.

    Gates:
      - 'gate1': Primary reminder (e.g. 24 hours before launch)
      - 'gate2': Secondary reminder (e.g. 30 minutes before launch)
      - 'inflight': Fires once when launch status changes to In Flight
    """
    __tablename__ = 'astro_launch_notifications'

    id = db.Column(db.Integer, primary_key=True)

    # Launch Library 2 UUID
    launch_id = db.Column(db.String(255), nullable=False)

    # Which gate: 'gate1', 'gate2', or 'inflight'
    gate = db.Column(db.String(20), nullable=False)

    # The NET (No Earlier Than) from the API — used to detect rescheduled launches
    launch_time = db.Column(db.DateTime(timezone=True), nullable=False)

    # When the notification should fire (null for inflight, which fires immediately)
    fire_at = db.Column(db.DateTime(timezone=True), nullable=True)

    # APScheduler job ID, used to cancel/reschedule (null for inflight)
    scheduler_job_id = db.Column(db.String(255), nullable=True)

    # 'scheduled' = waiting to fire, 'sent' = already delivered, 'cancelled' = invalidated
    status = db.Column(db.String(20), nullable=False, default='scheduled')

    # Snapshot fields for the notification payload (avoids re-fetching at fire time)
    launch_name = db.Column(db.String(500), nullable=False)
    provider = db.Column(db.String(255), nullable=False, default='Unknown')
    pad_name = db.Column(db.String(255), nullable=False, default='Unknown')

    created_at = db.Column(db.DateTime(timezone=True),
                           default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.UniqueConstraint('launch_id', 'gate', name='uq_astro_launch_notif_id_gate'),
        db.Index('idx_astro_launch_notif_status', 'status'),
        db.Index('idx_astro_launch_notif_launch_time', 'launch_time'),
    )

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'launch_id': self.launch_id,
            'gate': self.gate,
            'launch_time': self.launch_time.isoformat() if self.launch_time else None,
            'fire_at': self.fire_at.isoformat() if self.fire_at else None,
            'scheduler_job_id': self.scheduler_job_id,
            'status': self.status,
            'launch_name': self.launch_name,
            'provider': self.provider,
            'pad_name': self.pad_name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
