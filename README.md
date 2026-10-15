# Anime Tracker

> Episode progress tracker with AniList integration, Neon PostgreSQL, and multi-site watch links.

[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-20232A?logo=react)](https://react.dev/)
[![Neon](https://img.shields.io/badge/Neon-00E699?logo=postgresql)](https://neon.tech/)

---

## Screenshots / Design

| Feature | Preview |
|---|---|
| Search + Add | Live debounced search with cover, format, episode info |
| Library | Filter by status; progress tracking per anime |
| Watch Links | Saved sites first, then streaming suggestions |

*(Add real `.png`/`.jpg` screenshots to `docs/screens/` and replace links below.)*

---

## Stack

- **Backend:** Python 3.12 + FastAPI + SQLAlchemy + Alembic
- **DB:** PostgreSQL on [Neon](https://neon.tech) (`DATABASE_URL` / `DIRECT_URL`)
- **Frontend:** TypeScript + React + Vite + Tailwind + TanStack Query
- **Auth:** JWT access/refresh tokens
- **Anime Data:** [AniList GraphQL](https://graphql.anilist.co)

---

## Quick Setup

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Add Neon DATABASE_URL + DIRECT_URL
alembic upgrade head
uvicorn app.main:app --reload

# Frontend
cd ../frontend
npm install
npm run dev
```

---

## Neon Setup

1. Create project at [neon.tech](https://neon.tech) → copy `DATABASE_URL` + `DIRECT_URL`.
2. Put them in `backend/.env`.
3. Run `alembic upgrade head`.

---

## Env Variables (`backend/.env`)

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | JWT signing |
| `DATABASE_URL` / `DIRECT_URL` | Neon connection |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh lifetime |

---

## Features

- Search anime via AniList (live debounced input)
- Library: `watching` / `completed` / `plan_to_watch` / `on_hold` / `dropped`
- Episode-level progress tracking
- Save external watch sites per anime
- Stream links: saved sites → suggestions → search fallback

---

## Design Notes

- **Colors:** Deep navy (`#0f172a`) + neon teal (`#00e699`) accents; clean card-based layout.
- **Typography:** Inter / system sans-serif; large readable episode numbers.
- **Icons:** `public/icons.svg` for navigation and status badges.

---

## API Test

```bash
curl -X GET 'http://localhost:8000/api/v1/anime/search?q=One+Piece' \
  -H 'Authorization: Bearer <TOKEN>'
```
