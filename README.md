# Personal LMS

A learning management system for multi-certification prep (Security+, Network+, etc.) that bakes evidence-based learning science — active retrieval, mode variety, spaced repetition — into the core product instead of bolting them on.

Single user, local-first, no auth, no cloud.

## Stack

- **Desktop shell**: Electron + TypeScript (via `electron-vite`)
- **UI**: React 18 + Vite + Tailwind + shadcn/ui
- **Backend**: Django 5 + Django REST Framework
- **Database**: Postgres 16 (in Docker)
- **AI**: Anthropic Claude API (concept extraction + study item generation)

See the implementation plan at `plan.md` (TODO: copy from `~/.claude/plans/`) for the V1 scope and milestones.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js 20+](https://nodejs.org/)
- [Python 3.11+](https://www.python.org/)
- An [Anthropic API key](https://console.anthropic.com/)

## Setup (TODO — will fill in as milestones land)

```bash
# Clone
git clone <this-repo> && cd "Learning App"

# Copy env and fill in your ANTHROPIC_API_KEY
cp .env.example .env

# Start Postgres
docker compose up -d

# Backend (in one terminal)
cd lms_backend
python -m venv .venv
source .venv/bin/activate  # or: .venv\Scripts\activate on Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# Frontend / Electron (in another terminal, from repo root)
npm install
npm run dev
```

## Project status

- [x] M0: Repo init
- [ ] M1: Project skeleton + Docker Postgres + Electron/Django boot
- [ ] M2: Course / section / knowledge unit hierarchy
- [ ] M3: Note ingestion + Claude concept extraction
- [ ] M4: AI study item generation (5 modes)
- [ ] M5: Manual review UI
- [ ] M6: Mastery tracking + dashboard
