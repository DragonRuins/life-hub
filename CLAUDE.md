# Life Hub - CLAUDE.md

## Project Overview

Life Hub is a self-hosted personal dashboard and database application. It's a modular web app where each "module" is a self-contained feature area (vehicles, notes, etc.) with its own database models, API endpoints, and frontend pages. The user accesses it via a web browser.

**Owner:** Chase — has minimal Python experience, learning React. Explain things clearly and comment code well.

## Architecture

- **Backend:** Python 3.12, Flask, SQLAlchemy ORM, PostgreSQL
- **Frontend:** React 19 (Vite), React Router v7, Tailwind CSS v4, Lucide icons
- **Infrastructure:** Docker Compose for local dev, GitHub Actions builds images to GHCR, deployed on HexOS (TrueNAS-based) via Dockge

## Project Structure

```
life-hub/
├── docker-compose.yml          # Dev: builds from source with volume mounts
├── docker-compose.prod.yml     # Prod: uses pre-built GHCR images for Dockge
├── .env.example                # Environment variable template
├── .github/workflows/
│   └── docker-build.yml        # Auto-builds Docker images on push to main
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── run.py                  # Entry point
│   └── app/
│       ├── __init__.py         # Flask app factory, registers all blueprints
│       ├── config.py           # Config from environment variables
│       ├── models/             # SQLAlchemy database models
│       │   ├── vehicle.py      # Vehicle + MaintenanceLog models
│       │   └── note.py         # Note model
│       └── routes/             # API endpoint blueprints
│           ├── dashboard.py    # Weather proxy + summary stats
│           ├── vehicles.py     # Full CRUD for vehicles & maintenance
│           └── notes.py        # Full CRUD with search/filter/pin
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js          # Vite config with API proxy
│   ├── index.html
│   └── src/
│       ├── main.jsx            # React entry point
│       ├── index.css           # Global styles, Catppuccin Mocha theme
│       ├── App.jsx             # Router + sidebar layout
│       ├── api/
│       │   └── client.js       # API helper (all backend calls go through here)
│       ├── components/
│       │   └── weatherCodes.js # WMO weather code → description/emoji mapping
│       └── pages/
│           ├── Dashboard.jsx   # Main landing page with weather + module cards
│           ├── Vehicles.jsx    # Vehicle list + add form
│           ├── VehicleDetail.jsx # Single vehicle + maintenance log CRUD
│           └── Notes.jsx       # Notes with search, categories, pinning
```

## How to Add a New Module

This is the most common task. Follow this pattern:

### 1. Create the database model
Create `backend/app/models/<module_name>.py`:
- Define a SQLAlchemy model class with columns
- Add a `to_dict()` method for JSON serialization
- Import it in `backend/app/models/__init__.py`

### 2. Create API routes
Create `backend/app/routes/<module_name>.py`:
- Create a Flask Blueprint
- Add CRUD endpoints (GET list, GET single, POST create, PUT update, DELETE)
- Register the blueprint in `backend/app/__init__.py` under the "Register Modules" section

### 3. Add API client functions
Add a new section in `frontend/src/api/client.js`:
- Export an object with list/get/create/update/delete functions

### 4. Create frontend pages
Create page components in `frontend/src/pages/`:
- Add routes in `frontend/src/App.jsx`
- Add sidebar nav link in the `App.jsx` sidebar section
- Add a summary card on the Dashboard page

## Design System

The app uses a **Catppuccin Mocha** dark theme. Key CSS variables are defined in `frontend/src/index.css`:
- Backgrounds: `--color-crust`, `--color-mantle`, `--color-base`
- Text: `--color-text`, `--color-subtext-0`, `--color-subtext-1`
- Accents: `--color-blue`, `--color-green`, `--color-peach`, `--color-red`, `--color-mauve`, `--color-yellow`, `--color-teal`
- Surfaces: `--color-surface-0`, `--color-surface-1`, `--color-surface-2`

Fonts: **Outfit** for UI text, **JetBrains Mono** for code/monospace.
Reusable CSS classes: `.card`, `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-danger`

## API Conventions

- All API routes are prefixed with `/api/<module_name>/`
- JSON request/response bodies
- `to_dict()` on models for serialization
- `get_or_404()` for single-item lookups
- Required fields return 400 with `{"error": "message"}`
- Vite proxies `/api/*` to Flask in dev mode

### Form Pattern (Important!)

When creating form components that appear in modals:
- **The form should NOT call the API directly**
- Pass form data to parent via `onSubmit(data)` callback
- The parent page (e.g., VehicleDetail) handles the API call
- This prevents double-submission bugs where both form and parent try to create the same resource

**Incorrect pattern (causes double-submit):**
```jsx
// Form calls API AND calls onSubmit()
async function handleSubmit() {
  await api.create(data)  // First API call
  onSubmit()  // Parent also calls api.create()
}
```

**Correct pattern:**
```jsx
// Form just passes data to parent
function handleSubmit() {
  onSubmit(data)  // Parent handles API call
}
```

## Key Technical Decisions

- **Weather:** Uses Open-Meteo API (free, no key). Proxied through Flask so frontend doesn't make external calls directly.
- **Tags on notes:** Stored as comma-separated string for simplicity. Can migrate to many-to-many table later if needed.
- **Database:** Tables auto-created on Flask startup via `db.create_all()`. For production schema changes, use Flask-Migrate (alembic).
- **No auth yet:** This is a personal, local-network-only app. Authentication can be added later if needed.

## Running Locally

```bash
# First time setup
cp .env.example .env
docker compose up --build

# After code changes (hot-reload handles most, but if you change dependencies):
docker compose up --build

# Just start/stop
docker compose up -d
docker compose down
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api/health
- Database: localhost:5432 (user: lifehub, db: lifehub)

## Deployment to HexOS

1. Push to `main` branch → GitHub Actions builds images → pushed to GHCR
2. In Dockge on HexOS, create a stack using `docker-compose.prod.yml` contents
3. Replace `YOUR_GITHUB_USERNAME` with actual username
4. Set `DB_PASSWORD` and `SECRET_KEY` in Dockge environment variables
5. Deploy the stack

## Current Status (Phase 1 Complete)

### What's built:
- ✅ Dashboard with weather widget (5-day forecast) and module summary cards
- ✅ Vehicles module: add vehicles, view details, full maintenance log CRUD
- ✅ Notes module: create/edit/delete, search, category filter, pin to top
- ✅ Sidebar navigation with collapsible toggle
- ✅ Docker Compose for dev and prod
- ✅ GitHub Actions CI/CD pipeline
- ✅ Catppuccin Mocha dark theme

### Planned future modules/features:
- Fuel logging (integrate Fuelly-like tracking)
- Finance/expense tracking
- Project/task management
- Inventory/collections tracking
- Dashboard activity feed (recent actions across all modules)
- Data export/backup functionality
- Mobile-responsive improvements
- Inline editing on vehicle details (currently need to use API directly to edit vehicle info)
