# Anime Tracker

Episode progress tracker for anime using Python FastAPI, TypeScript/Vite frontend, PostgreSQL on Neon.

## Stack
- Backend: Python 3.12 + FastAPI + SQLAlchemy + Alembic
- DB: PostgreSQL (Neon) — `DATABASE_URL` / `DIRECT_URL`
- Frontend: TypeScript + React + Vite + Tailwind + TanStack Query
- Auth: JWT access/refresh tokens

## Quick Setup

```bash
# 1. Backend
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # set DATABASE_URL / DIRECT_URL for Neon
alembic upgrade head
uvicorn app.main:app --reload

# 2. Frontend
cd ../frontend
npm install
npm run dev
```

## Env Variables (backend `.env`)
- `SECRET_KEY`
- `DATABASE_URL` / `DIRECT_URL` (Neon)
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `REFRESH_TOKEN_EXPIRE_DAYS`
- `JINA_AI_API_KEY` (for anime search / summary)

## Project Phases
- Phase 0: Setup / repo / env
- Phase 1: Auth / DB / FastAPI core
- Phase 2: Anime search / progress tracking / frontend

## Test Backend API (auth required)
```bash
curl -X GET 'http://localhost:8000/api/v1/anime/search?q=One+Piece' \
  -H 'Authorization: Bearer <TOKEN>'
```
