# Datacore

A self-hosted personal dashboard and database for tracking everything in your life. Built with Flask, React, and PostgreSQL, with a native iOS/macOS companion app.

![Stack](https://img.shields.io/badge/Python_3.12-Flask-blue) ![Stack](https://img.shields.io/badge/React_19-Vite-cyan) ![Stack](https://img.shields.io/badge/PostgreSQL_16-Database-blue) ![Stack](https://img.shields.io/badge/Docker-Compose-blue) ![Stack](https://img.shields.io/badge/SwiftUI-iOS_26-orange)

## Modules

| Module | Description |
|--------|-------------|
| **Dashboard** | Weather forecast (Open-Meteo), system stats, fleet status, module summaries |
| **Vehicles** | Vehicle inventory, maintenance logs, fuel logs, tire sets, component tracking, configurable service intervals |
| **Notes** | Rich text editor (TipTap), hierarchical folders, tags, attachments, search, pin/favorite/trash |
| **Fuel Economy** | Fleet-wide analytics with MPG trends, cost analysis, per-vehicle breakdowns, Fuelly CSV import |
| **Projects** | Project tracking with Kanban boards (drag-and-drop), tech stack, changelog, tags |
| **Knowledge Base** | Wiki-style articles with TipTap editor, categories, revisions, backlinks, templates, Mermaid diagrams |
| **Infrastructure** | Server/host inventory, Docker container sync, service health monitoring, metrics, incident tracking |
| **Smart Home** | Home Assistant integration, device control, room management, camera streams |
| **3D Printer** | Print job tracking and monitoring |
| **Astrometrics** | NASA APOD, near-Earth objects, ISS tracker with Leaflet map, rocket launch schedule |
| **Trek Database** | Star Trek encyclopedia via STAPI — ships, episodes, characters, daily random entries, favorites |
| **AI Chat** | Conversational AI via Anthropic API with streaming, conversation history, and tool use |
| **Notifications** | Rule-based alerts with channels (Discord, email, Pushover, SMS, in-app), quiet hours, history |

## Triple-Theme System

Every page is implemented three times in three distinct visual languages:

| Theme | Style | Font |
|-------|-------|------|
| **Catppuccin Mocha** | Dark theme with pastel accents | Outfit / JetBrains Mono |
| **LCARS** | Star Trek computer interface with elbows, cascades, pill buttons, boot sequence | Antonio |
| **Liquid Glass** | Apple WWDC 2025 design language — floating sidebar, bento grids, glass material effects | SF Pro / Inter |

Theme preference is stored in localStorage and can be switched at any time. Each theme has its own layout shell, navigation, component library, and per-page implementations — they are not reskins of each other.

## Native iOS/macOS App

A companion SwiftUI app consumes the same Flask API. Built with iOS 26 / Swift 6 / MVVM architecture.

- **iPhone** — Standard `TabView` navigation, mobile-first design with Liquid Glass
- **iPad** — Command Center layout with `CommandRail`, `LiveStatusBar`, dense bento grid dashboard
- **Mac** — `NavigationSplitView` with sidebar, toolbar, and split pane layouts

Located at a separate repo path. See `CLAUDE.md` for full iOS architecture docs.

## Quick Start

### Prerequisites

1. **Docker Desktop** — [Download here](https://www.docker.com/products/docker-desktop/)
2. **Git** — included with macOS (`git --version` to verify)

### Setup

```bash
# Clone and configure
git clone https://github.com/YOUR_USERNAME/datacore.git
cd datacore
cp .env.example .env
# Edit .env — set DB_PASSWORD, SECRET_KEY, and optionally:
#   WEATHER_LAT / WEATHER_LON (weather location)
#   ANTHROPIC_API_KEY (AI chat)

# Start everything
docker compose up --build
# First run takes a few minutes. Subsequent starts are faster.
```

### Access

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:5000/api/health |
| Database | localhost:5432 (user: lifehub, db: lifehub) |

### Development Workflow

The app hot-reloads in development:
- Edit a Python file in `backend/` — Flask restarts automatically
- Edit a React file in `frontend/src/` — Vite HMR refreshes the browser

```bash
docker compose down          # Stop
docker compose up -d         # Start in background
docker compose up --build    # Rebuild after dependency changes
```

### Using Claude Code

```bash
cd datacore
claude
# Claude reads CLAUDE.md for full project context
```

## Deploying to HexOS (Dockge)

Uses pre-built images from GitHub Container Registry. GitHub Actions auto-builds on push to `main`.

1. Push to `main` — images build automatically (~40 seconds)
2. In Dockge, create a stack with `docker-compose.prod.yml` contents
3. Set environment variables: `DB_PASSWORD`, `SECRET_KEY`, `ANTHROPIC_API_KEY`
4. Deploy — click **Update** in Dockge after each push

## Mobile Fuel Entry

Standalone phone-friendly page for logging fill-ups at the gas station — no sidebar, designed for home screen bookmarks.

**URL:** `http://<server-ip>:3000/fuel/add/<vehicle-id>`

**Save to iPhone Home Screen:** Safari → Share → "Add to Home Screen" → opens in standalone mode

Features:
- Form state persists in localStorage (lock phone, pump gas, come back)
- Large touch targets with numeric keyboard
- Live cost preview as you type
- Missed fill-up toggle (skips MPG calculation)
- Success screen with calculated MPG and total cost

## Tech Stack

### Backend
| Package | Purpose |
|---------|---------|
| Flask 3.1 | Web framework |
| SQLAlchemy + Flask-Migrate | ORM and database migrations |
| PostgreSQL 16 | Database (via psycopg2) |
| APScheduler | Background jobs (health checks, metric polling) |
| Gunicorn | Production WSGI server |
| Anthropic SDK | AI chat integration |
| Skyfield | ISS position and pass calculations |
| Docker SDK | Container sync for infrastructure module |

### Frontend
| Package | Purpose |
|---------|---------|
| React 19 + Vite 6 | UI framework and build tool |
| React Router 7 | Client-side routing |
| Tailwind CSS 4 | Utility CSS |
| TipTap | Rich text editor (notes, knowledge base) |
| Recharts | Charts and data visualization |
| dnd-kit | Drag-and-drop (Kanban boards) |
| Leaflet | Maps (ISS tracker) |
| Mermaid | Diagram rendering in articles |
| Lucide | Icon library |

## Project Structure

```
datacore/
├── backend/
│   ├── app/
│   │   ├── models/           # SQLAlchemy models (14 model files)
│   │   ├── routes/           # Flask blueprints (14 route files)
│   │   └── services/         # Business logic, integrations, background jobs
│   │       ├── channels/     # Notification delivery (Discord, email, SMS, Pushover)
│   │       ├── astrometrics/ # NASA API client, ISS passes, caching
│   │       ├── infrastructure/ # Docker, Portainer, Home Assistant, host stats
│   │       └── trek/         # STAPI client, entity registry
│   └── run.py
├── frontend/
│   └── src/
│       ├── api/client.js     # All API calls
│       ├── components/       # Shared components (forms, cards, widgets)
│       ├── pages/            # Catppuccin theme pages
│       │   ├── notes/        # Notes sub-components (editor, sidebar, folders)
│       │   ├── notifications/# Notification settings sub-pages
│       │   ├── trek/         # Trek sub-pages (browse, search, episodes, ships)
│       │   ├── kb/           # Knowledge base sub-pages (editor, reader, categories)
│       │   └── settings/     # Settings sub-pages (AI, Astro, import, vehicles)
│       └── themes/
│           ├── lcars/        # LCARS theme (Star Trek) — full page set + settings/
│           └── glass/        # Liquid Glass theme (Apple) — full page set + settings/
├── docker-compose.yml        # Local development
├── docker-compose.prod.yml   # Production (GHCR images)
├── .github/workflows/        # CI/CD — builds to ghcr.io/dragonruins/*
└── CLAUDE.md                 # Full project context for Claude Code
```

## API

All endpoints are prefixed with `/api/<module>/` and return JSON. Key route groups:

| Prefix | Routes | Description |
|--------|--------|-------------|
| `/api/dashboard` | 4 | Weather proxy, summary stats, system stats, fleet status |
| `/api/vehicles` | 42 | Full CRUD for vehicles, maintenance, fuel, tires, components, intervals |
| `/api/notes` | 12 | CRUD with soft delete, trash, move, tags, stats |
| `/api/folders` | 5 | Hierarchical folder tree for notes |
| `/api/attachments` | 5 | File upload, serve, and metadata |
| `/api/fuel` | 5 | Fuel entries, import, stats |
| `/api/projects` | 25+ | Projects, Kanban columns/tasks, tags, tech stack, changelog |
| `/api/kb` | 25+ | Articles, categories, revisions, templates, backlinks, search |
| `/api/infrastructure` | 68 | Hosts, containers, services, incidents, integrations, smart home, printer |
| `/api/astrometrics` | 15 | APOD, NEO, ISS, launches, settings |
| `/api/trek` | 20+ | Daily entries, search, browse, episodes, ships, favorites |
| `/api/ai` | 6 | Chat conversations, streaming, settings |
| `/api/notifications` | 25+ | Rules, channels, feed, settings, history |
| `/api/import` | 2 | Fuelly CSV import (maintenance + fuel) |

## Adding New Modules

See `CLAUDE.md` for the full guide. In short:

1. Create a database model in `backend/app/models/`
2. Create API routes in `backend/app/routes/`
3. Register the blueprint in `backend/app/__init__.py`
4. Add API client functions in `frontend/src/api/client.js`
5. Create page components in **all three themes**:
   - `frontend/src/pages/` (Catppuccin)
   - `frontend/src/themes/lcars/` (LCARS)
   - `frontend/src/themes/glass/` (Liquid Glass)
6. Add routes and nav links in `App.jsx` for each theme shell
