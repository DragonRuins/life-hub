# Models package - import all models here so they're registered with SQLAlchemy
from .vehicle import Vehicle, MaintenanceLog, VehicleComponent, ComponentLog, TireSet, FuelLog
from .notification import (
    NotificationChannel, NotificationRule, NotificationRuleChannel,
    NotificationLog, NotificationSettings
)
from .maintenance_interval import MaintenanceItem, VehicleMaintenanceInterval, MaintenanceLogItem
from .note import Note
from .folder import Folder
from .tag import Tag, note_tags
from .attachment import Attachment, NoteAttachment
from .project import (
    Project, ProjectTechStack, ProjectTag, project_tag_map,
    ProjectKanbanColumn, ProjectTask, ProjectChangelog
)
from .kb import (
    KBCategory, KBTag, kb_article_tags, KBArticle,
    KBArticleLink, KBArticleRevision, KBBookmark, KBRecentView
)
from .astrometrics import AstroCache, AstroApodFavorite, AstroSettings, AstroLaunchNotification
from .trek import TrekDailyEntry, TrekFavorite, TrekSettings
from .ai_chat import Conversation, Message, AISettings
from .work_hours import WorkHoursLog
