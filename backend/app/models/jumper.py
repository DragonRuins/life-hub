"""
Jumper/Bypass Module - Database Models

Defines four tables:
  - jumper_sites: Customer facilities where jumpers are installed
  - jumper_cpus: PLC processors at each site
  - jumper_tags: Job/work-order tags per site
  - jumpers: Individual bypass records (the core tracking entity)

A "jumper" (a.k.a. bypass) is a temporary override installed in a PLC
program. They must be tracked, time-limited, and removed when the
underlying issue is resolved. Active jumpers have removed_at = NULL.
"""
from datetime import datetime, timezone
from app import db


class JumperSite(db.Model):
    """A customer facility where jumpers/bypasses are installed."""
    __tablename__ = 'jumper_sites'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)          # Site/facility name
    address = db.Column(db.String(500), nullable=True)        # Physical address
    contact_name = db.Column(db.String(200), nullable=True)   # Primary contact person
    contact_phone = db.Column(db.String(50), nullable=True)   # Contact phone number
    contact_email = db.Column(db.String(200), nullable=True)  # Contact email
    notes = db.Column(db.Text, nullable=True)                 # Any extra info about the site

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relationships: deleting a site cascades to its cpus, tags, and jumpers
    cpus = db.relationship('JumperCPU', backref='site', cascade='all, delete-orphan')
    tags = db.relationship('JumperTag', backref='site', cascade='all, delete-orphan')
    jumpers = db.relationship('Jumper', backref='site', cascade='all, delete-orphan')

    def to_dict(self, include_counts=False):
        """Convert to dictionary for JSON responses.

        Args:
            include_counts: If True, includes active_jumper_count
                            (requires a query, so opt-in only).
        """
        data = {
            'id': self.id,
            'name': self.name,
            'address': self.address,
            'contact_name': self.contact_name,
            'contact_phone': self.contact_phone,
            'contact_email': self.contact_email,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() + 'Z' if self.created_at else None,
            'updated_at': self.updated_at.isoformat() + 'Z' if self.updated_at else None,
        }
        if include_counts:
            data['active_jumper_count'] = sum(
                1 for j in self.jumpers if j.removed_at is None
            )
        return data

    def to_detail_dict(self):
        """Full site details including cpus and tags lists."""
        data = self.to_dict(include_counts=True)
        data['cpus'] = [c.to_dict() for c in self.cpus]
        data['tags'] = [t.to_dict() for t in self.tags]
        return data


class JumperCPU(db.Model):
    """A PLC processor (CPU) at a site. Used to group jumpers by controller."""
    __tablename__ = 'jumper_cpus'
    __table_args__ = (
        db.UniqueConstraint('site_id', 'name', name='uq_jumper_cpu_site_name'),
    )

    id = db.Column(db.Integer, primary_key=True)
    site_id = db.Column(
        db.Integer,
        db.ForeignKey('jumper_sites.id', ondelete='CASCADE'),
        nullable=False
    )
    name = db.Column(db.String(200), nullable=False)  # e.g., "PLC-01", "Main CPU"
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationship: one CPU has many jumpers
    jumpers = db.relationship('Jumper', backref='cpu')

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'site_id': self.site_id,
            'name': self.name,
            'created_at': self.created_at.isoformat() + 'Z' if self.created_at else None,
        }


class JumperTag(db.Model):
    """A job/work-order tag at a site. Used to group jumpers by job."""
    __tablename__ = 'jumper_tags'
    __table_args__ = (
        db.UniqueConstraint('site_id', 'name', name='uq_jumper_tag_site_name'),
    )

    id = db.Column(db.Integer, primary_key=True)
    site_id = db.Column(
        db.Integer,
        db.ForeignKey('jumper_sites.id', ondelete='CASCADE'),
        nullable=False
    )
    name = db.Column(db.String(200), nullable=False)  # e.g., "WO-2026-001"
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationship: one tag has many jumpers
    jumpers = db.relationship('Jumper', backref='tag')

    def to_dict(self):
        """Convert to dictionary for JSON responses."""
        return {
            'id': self.id,
            'site_id': self.site_id,
            'name': self.name,
            'created_at': self.created_at.isoformat() + 'Z' if self.created_at else None,
        }


class Jumper(db.Model):
    """A single bypass/jumper record installed in a PLC program.

    Active jumpers have removed_at = NULL. Once removed, removed_at is
    set to the removal timestamp and an optional removal_note is recorded.
    """
    __tablename__ = 'jumpers'
    __table_args__ = (
        db.Index('ix_jumpers_site_id', 'site_id'),
        db.Index('ix_jumpers_removed_at', 'removed_at'),
    )

    id = db.Column(db.Integer, primary_key=True)
    site_id = db.Column(
        db.Integer,
        db.ForeignKey('jumper_sites.id', ondelete='CASCADE'),
        nullable=False
    )
    cpu_id = db.Column(
        db.Integer,
        db.ForeignKey('jumper_cpus.id', ondelete='SET NULL'),
        nullable=True
    )
    tag_id = db.Column(
        db.Integer,
        db.ForeignKey('jumper_tags.id', ondelete='SET NULL'),
        nullable=True
    )

    location = db.Column(db.String(500), nullable=False)     # Program location (rung, routine, etc.)
    reason = db.Column(db.Text, nullable=False)               # Why the jumper was installed
    description = db.Column(db.Text, nullable=True)           # Additional details
    permit_number = db.Column(db.String(100), nullable=True)  # Associated permit number
    moc_number = db.Column(db.String(100), nullable=True)     # Management of Change number

    is_long_term = db.Column(db.Boolean, default=False)       # True = intentionally long-lived bypass

    installed_at = db.Column(
        db.DateTime, nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )
    removed_at = db.Column(db.DateTime, nullable=True)        # NULL = still active
    removal_note = db.Column(db.Text, nullable=True)          # Why/how it was removed

    notified_at = db.Column(db.DateTime, nullable=True)       # When the 8-hour reminder was sent

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    def to_dict(self):
        """Convert to dictionary for JSON responses.

        Includes cpu_name, tag_name, and site_name from relationships
        so the frontend doesn't need separate lookups.
        """
        return {
            'id': self.id,
            'site_id': self.site_id,
            'site_name': self.site.name if self.site else None,
            'cpu_id': self.cpu_id,
            'cpu_name': self.cpu.name if self.cpu else None,
            'tag_id': self.tag_id,
            'tag_name': self.tag.name if self.tag else None,
            'location': self.location,
            'reason': self.reason,
            'description': self.description,
            'permit_number': self.permit_number,
            'moc_number': self.moc_number,
            'is_long_term': self.is_long_term,
            'installed_at': self.installed_at.isoformat() + 'Z' if self.installed_at else None,
            'removed_at': self.removed_at.isoformat() + 'Z' if self.removed_at else None,
            'removal_note': self.removal_note,
            'notified_at': self.notified_at.isoformat() + 'Z' if self.notified_at else None,
            'created_at': self.created_at.isoformat() + 'Z' if self.created_at else None,
            'updated_at': self.updated_at.isoformat() + 'Z' if self.updated_at else None,
        }
