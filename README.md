# 🏠 Life Hub

A self-hosted personal dashboard and database for tracking everything in your life. Built with Flask, React, and PostgreSQL.

![Stack](https://img.shields.io/badge/Flask-Backend-blue) ![Stack](https://img.shields.io/badge/React-Frontend-cyan) ![Stack](https://img.shields.io/badge/PostgreSQL-Database-blue) ![Stack](https://img.shields.io/badge/Docker-Deployment-blue)

## Features

- **Dashboard** — Weather widget with 5-day forecast, quick stats from all modules
- **Vehicles** — Track your vehicles, log maintenance records, track costs
- **Notes** — Create, search, categorize, tag, and pin notes
- **Fuel Economy** — Log fill-ups, track MPG over time with charts, Fuelly CSV import
- **Mobile Fuel Entry** — Standalone phone-friendly page for logging fill-ups at the pump
- **Modular** — Easy to add new modules for anything you want to track

## Quick Start (Mac Development)

### Prerequisites

1. **Docker Desktop** — [Download here](https://www.docker.com/products/docker-desktop/) and install
2. **Git** — Already included with macOS (verify: `git --version`)
3. **Claude Code** (optional) — `npm install -g @anthropic-ai/claude-code`

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/life-hub.git
cd life-hub

# 2. Create your environment file
cp .env.example .env
# Edit .env and set a real DB_PASSWORD and SECRET_KEY

# 3. Start everything
docker compose up --build

# First run takes a few minutes to download images and install dependencies.
# Subsequent starts are much faster.
```

### Access

- **Dashboard:** http://localhost:3000
- **API Health Check:** http://localhost:5000/api/health

### Development Workflow

The app hot-reloads in development:
- Edit a Python file in `backend/` → Flask restarts automatically
- Edit a React file in `frontend/src/` → Browser refreshes automatically

To stop: `docker compose down`
To restart: `docker compose up -d` (runs in background)

### Using Claude Code

```bash
cd life-hub
claude
# Then just describe what you want:
# "Add a fuel log feature to the vehicles module"
# "Make the dashboard cards link to their respective pages"
# "Add a dark/light theme toggle"
```

Claude Code reads `CLAUDE.md` for full project context.

## Deploying to HexOS (Dockge)

See `docker-compose.prod.yml` — uses pre-built images from GitHub Container Registry.

1. Push code to `main` → GitHub Actions builds Docker images automatically
2. In Dockge, create a new stack with the contents of `docker-compose.prod.yml`
3. Set environment variables (`DB_PASSWORD`, `SECRET_KEY`, `FUEL_API_KEY`) in Dockge
4. Deploy

To update after pushing new code: wait ~40 seconds for GitHub Actions to build, then click **Update** in Dockge.

## Mobile Fuel Entry

A standalone, phone-friendly page for logging fuel fill-ups at the gas station. No sidebar — designed to be bookmarked or saved to your home screen.

**URL:** `http://<server-ip>:3000/fuel/add/<vehicle-id>`

Replace `<server-ip>` with your server's IP address and `<vehicle-id>` with the numeric ID of the vehicle (visible on the Vehicles page).

### Save to iPhone Home Screen

1. Open the URL above in Safari on your phone
2. Tap the **Share** button (square with arrow)
3. Tap **"Add to Home Screen"**
4. It saves as "Fuel Log" with a fuel pump icon and opens in standalone mode (no browser toolbar)

### How It Works

- **Form persists as you type** — saved to localStorage, so you can lock your phone, pump gas, and come back without losing data
- **Large touch inputs** with numeric keyboard for easy entry at the pump
- **Live cost preview** — shows estimated total as you fill in gallons and price
- **Missed fill-up toggle** — skips MPG calculation if you forgot to log a previous fill-up
- **Success screen** — shows calculated MPG and total cost after submission

## Project Structure

```
life-hub/
├── backend/          # Flask API (Python)
│   ├── app/
│   │   ├── models/   # Database table definitions
│   │   └── routes/   # API endpoints
│   └── run.py        # Entry point
├── frontend/         # React app
│   └── src/
│       ├── api/      # API client helpers
│       ├── components/
│       └── pages/    # Dashboard, Vehicles, Notes
├── docker-compose.yml      # Local development
├── docker-compose.prod.yml # Production (HexOS/Dockge)
└── CLAUDE.md               # Context file for Claude Code
```

## Adding New Modules

See `CLAUDE.md` for the full guide. In short:
1. Add a database model in `backend/app/models/`
2. Add API routes in `backend/app/routes/`
3. Register the blueprint in `backend/app/__init__.py`
4. Add API client functions in `frontend/src/api/client.js`
5. Create page components in `frontend/src/pages/`
6. Add route and sidebar link in `frontend/src/App.jsx`
