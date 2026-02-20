"""
Star Trek Database Module - Database Models

Three tables for the STAPI-powered Star Trek encyclopedia:
  - trek_daily_entry: Daily featured entry (auto-picked by scheduler)
  - trek_favorites: User-bookmarked entries with optional notes
  - trek_settings: Singleton configuration for daily entry categories and cache TTLs

All Star Trek data itself lives in the astro_cache table (reused from
astrometrics) under source prefixes like 'stapi_detail', 'stapi_search', etc.
These three tables only store user-facing state and preferences.
"""
from datetime import datetime, timezone
from app import db


class TrekDailyEntry(db.Model):
    """
    The Star Trek 'Entry of the Day' — one featured entity per day.

    Auto-populated by the scheduler at 6 AM daily. Rotates through
    categories (characters, spacecraft, species, etc.) so the user
    gets a different type of entry each day.

    The summary_data JSON stores key display fields so the frontend
    can render the daily card without an extra API call.
    """
    __tablename__ = 'trek_daily_entry'

    id = db.Column(db.Integer, primary_key=True)
    entry_date = db.Column(db.Date, unique=True, nullable=False)
    entity_type = db.Column(db.String(50), nullable=False)     # e.g., 'character', 'spacecraft'
    entity_uid = db.Column(db.String(100), nullable=False)     # STAPI UID, e.g., 'CHMA0000215045'
    entity_name = db.Column(db.String(500), nullable=False)    # Display name
    summary_data = db.Column(db.JSON, nullable=False)          # Key fields for card display
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.Index('idx_trek_daily_date', entry_date.desc()),
    )

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'entry_date': self.entry_date.isoformat() if self.entry_date else None,
            'entity_type': self.entity_type,
            'entity_uid': self.entity_uid,
            'entity_name': self.entity_name,
            'summary_data': self.summary_data,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class TrekFavorite(db.Model):
    """
    A user-bookmarked Star Trek entry.

    Stores the entity reference (type + UID) along with a snapshot of
    the entity name and summary data. The user can optionally add
    personal notes to any favorite.

    The (entity_type, entity_uid) pair is unique — you can't favorite
    the same entity twice.
    """
    __tablename__ = 'trek_favorites'

    id = db.Column(db.Integer, primary_key=True)
    entity_type = db.Column(db.String(50), nullable=False)     # e.g., 'character'
    entity_uid = db.Column(db.String(100), nullable=False)     # STAPI UID
    entity_name = db.Column(db.String(500), nullable=False)    # Display name
    summary_data = db.Column(db.JSON, default=dict)            # Snapshot of key fields
    notes = db.Column(db.Text)                                 # User's personal notes
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.UniqueConstraint('entity_type', 'entity_uid', name='uq_trek_fav_type_uid'),
        db.Index('idx_trek_fav_type', 'entity_type'),
    )

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'entity_type': self.entity_type,
            'entity_uid': self.entity_uid,
            'entity_name': self.entity_name,
            'summary_data': self.summary_data,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class TrekSettings(db.Model):
    """
    Singleton settings for the Star Trek Database module.

    Same pattern as NotificationSettings and AstroSettings:
    one row (id=1) with configurable defaults. Use get_settings()
    to safely retrieve or create the settings row.
    """
    __tablename__ = 'trek_settings'

    id = db.Column(db.Integer, primary_key=True, default=1)

    # Which entity categories the daily entry picker rotates through
    daily_entry_categories = db.Column(
        db.JSON,
        default=lambda: ['character', 'spacecraft', 'species', 'astronomicalObject', 'technology', 'episode']
    )

    # Cache TTLs (in hours) — controls how long STAPI data stays fresh
    cache_ttl_detail_hours = db.Column(db.Integer, default=168)   # 7 days for detail pages
    cache_ttl_search_hours = db.Column(db.Integer, default=24)    # 24 hours for search results

    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    @classmethod
    def get_settings(cls):
        """
        Get the singleton settings row, creating it if it doesn't exist.

        Returns:
            TrekSettings: The settings instance
        """
        settings = cls.query.first()
        if not settings:
            settings = cls(id=1)
            db.session.add(settings)
            db.session.commit()
        return settings

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'daily_entry_categories': self.daily_entry_categories,
            'cache_ttl_detail_hours': self.cache_ttl_detail_hours,
            'cache_ttl_search_hours': self.cache_ttl_search_hours,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
