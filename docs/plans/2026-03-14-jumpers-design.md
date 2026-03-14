# Jumpers/Bypasses Module — Design Document

**Date:** 2026-03-14
**Status:** Approved
**Platforms:** Backend API + iOS/iPad/Mac (no web frontend, no watchOS)

## Purpose

Track PLC logic jumpers/bypasses installed at customer sites. Provides per-site management, progressive registration of CPUs and tags, removal audit trail, and timed push notifications for short-term jumpers left in place beyond 8 hours.

## Data Model

### `jumper_sites` — Customer facilities

| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| name | String(200) | e.g., "Acme Manufacturing - Plant 3" |
| address | String(500) | nullable |
| contact_name | String(200) | nullable |
| contact_phone | String(50) | nullable |
| contact_email | String(200) | nullable |
| notes | Text | Site-specific notes, default permit reqs, access info |
| created_at | DateTime | UTC |
| updated_at | DateTime | UTC |

### `jumper_cpus` — Progressively registered CPUs per site

| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| site_id | Integer FK -> jumper_sites | CASCADE on delete |
| name | String(200) | e.g., "CPU-100" |
| created_at | DateTime | |

Unique constraint on (site_id, name).

### `jumper_tags` — Progressively registered tags per site

| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| site_id | Integer FK -> jumper_sites | CASCADE on delete |
| name | String(200) | e.g., "Boiler-Rebuild-2026" |
| created_at | DateTime | |

Unique constraint on (site_id, name).

### `jumpers` — Bypass records

| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| site_id | Integer FK -> jumper_sites | CASCADE on delete |
| cpu_id | Integer FK -> jumper_cpus | SET NULL on delete |
| tag_id | Integer FK -> jumper_tags | nullable, SET NULL on delete |
| location | String(500) | Program location (rung, routine, address) |
| reason | Text | Why the jumper was installed |
| description | Text | What the jumper does |
| permit_number | String(100) | nullable |
| moc_number | String(100) | nullable |
| is_long_term | Boolean | Default false. Long-term skips 8hr notification |
| installed_at | DateTime | When the jumper was put in |
| removed_at | DateTime | nullable — null means still active |
| removal_note | Text | Optional note when removing |
| notified_at | DateTime | nullable — when the 8hr reminder was sent |
| created_at | DateTime | |
| updated_at | DateTime | |

## API Design

All endpoints under `/api/jumpers/`.

### Sites

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jumpers/sites` | List all sites (with active jumper counts) |
| POST | `/api/jumpers/sites` | Create a site |
| GET | `/api/jumpers/sites/:id` | Get site detail (with CPUs, tags, active jumpers) |
| PUT | `/api/jumpers/sites/:id` | Update a site |
| DELETE | `/api/jumpers/sites/:id` | Delete site (cascades jumpers, CPUs, tags) |

### Jumpers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jumpers/sites/:site_id/jumpers` | List jumpers for a site (filterable: active/removed, by tag, by CPU) |
| POST | `/api/jumpers/sites/:site_id/jumpers` | Create a jumper (auto-creates CPU/tag if new) |
| GET | `/api/jumpers/jumpers/:id` | Get single jumper |
| PUT | `/api/jumpers/jumpers/:id` | Update a jumper |
| PUT | `/api/jumpers/jumpers/:id/remove` | Mark as removed (accepts optional removal_note) |
| DELETE | `/api/jumpers/jumpers/:id` | Hard delete (for mistakes) |

### Stats

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jumpers/stats` | Dashboard stats: total active, most recent, oldest active, sites ranked by active count, overdue count |

### CPU/Tag Auto-Creation

No dedicated CRUD endpoints. CPUs and tags are created automatically when a jumper is submitted with a new name. The site detail endpoint returns existing CPUs and tags for dropdown population in the app.

## Notification Design

Uses the existing APScheduler one-shot pattern (same as launch reminders).

### Flow

1. When a **short-term** jumper is created, schedule a one-shot APScheduler job for `installed_at + 8 hours`.
2. Job ID format: `jumper_reminder_{jumper_id}`.
3. When the job fires:
   - Check jumper is still active (`removed_at IS NULL`) and still short-term (`is_long_term = False`).
   - If so, fire a push notification via `schedule_delayed_push()` and set `notified_at`.
   - If already removed or toggled to long-term, no-op.
4. **Cancellation triggers** (cancel the scheduled job):
   - Jumper is removed (via `/remove` endpoint)
   - Jumper is toggled from short-term to long-term (via PUT update)
   - Jumper is hard-deleted
5. **Startup reconciliation**: on app boot, check for active short-term jumpers >8hrs old with `notified_at IS NULL` and fire missed notifications.

### New Scheduler Functions

- `schedule_jumper_reminder(jumper_id, fire_at)` — schedules the one-shot job
- `cancel_jumper_reminder(jumper_id)` — cancels it (safe if already fired/missing)
- `_fire_jumper_reminder(jumper_id)` — callback that checks status and sends push
- `_reconcile_jumper_reminders()` — startup catch-up, called from `init_scheduler`

### Push Notification Content

- **Title:** "Jumper Still Active"
- **Body:** "Jumper at {site_name} / {cpu_name} — {location} has been in place for 8 hours. Reason: {reason}"

## Apple App Design (Mac, iPad, iPhone)

### Navigation

- "Jumpers" entry added to Mac sidebar, iPad sidebar, and iPhone TabView.
- SF Symbol: `bolt.horizontal.circle` or similar.

### Module Home View — Stats Dashboard

- Total active jumpers, most recent jumper, oldest active (with age), overdue count
- Sites ranked by active jumper count
- Quick-add button
- Uses `PremiumStatCard` + `CountingNumber` from the design system
- iPad/Mac: bento-style grid layout
- iPhone: single-column scroll

### Site List View

- All sites with name and active jumper count
- Tap through to site detail
- Add site button

### Site Detail View

- Site info header (name, address, contact, notes) — editable
- Jumpers list, filterable by status (active/removed/all), CPU, tag
- Each row: CPU, location, reason, permit #, MOC #, tag, installed timestamp, long-term badge
- Actions: remove (with optional note), edit, delete
- Add jumper button
- iPad/Mac: split layout (list + inline detail)
- iPhone: standard push navigation

### Jumper Form (Sheet/Modal)

- CPU: combo-box (type to search existing or create new)
- Location: text field
- Reason: text field
- Description: multiline text
- Permit #: optional text field
- MOC #: optional text field
- Tag: combo-box (search existing or create new, optional)
- Installed at: datetime picker, defaults to now
- Short-term / Long-term: toggle, defaults to short-term

### Remove Jumper Flow

- Confirmation sheet with optional removal note text field.
- Sets `removed_at` to current timestamp.

## What's Not Included

- No web frontend (no React/Catppuccin/LCARS pages)
- No watchOS views
- No multi-tag per jumper (one tag max)
- No formal job/work-order entity (tags serve this purpose)
