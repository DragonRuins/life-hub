# 🏠 Life Hub

A self-hosted personal dashboard and database for tracking everything in your life. Built with Flask, React, and PostgreSQL.

![Stack](https://img.shields.io/badge/Flask-Backend-blue) ![Stack](https://img.shields.io/badge/React-Frontend-cyan) ![Stack](https://img.shields.io/badge/PostgreSQL-Database-blue) ![Stack](https://img.shields.io/badge/Docker-Deployment-blue)

## Features

- **Dashboard** — Weather widget with 5-day forecast, quick stats from all modules
- **Vehicles** — Track your vehicles, log maintenance records, track costs
- **Notes** — Create, search, categorize, tag, and pin notes
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
3. Replace `YOUR_GITHUB_USERNAME` with your GitHub username
4. Set environment variables (`DB_PASSWORD`, `SECRET_KEY`) in Dockge
5. Deploy

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
