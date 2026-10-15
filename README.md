# Anime Tracker

Episode progress tracker. Search comes from AniList. Your list, episode progress, and watch-site links are stored in Neon Postgres. A Chrome extension can save the episode you are watching.

## Stack

- Backend: Python 3.12, FastAPI, SQLAlchemy, Alembic
- Database: Neon Postgres. `DATABASE_URL` is the pooled URL. `DIRECT_URL` is the direct URL used only by Alembic.
- Frontend: TypeScript, React, Vite, Tailwind, TanStack Query
- Extension: Chrome Manifest V3, loaded unpacked

## Prerequisites

- Git
- Node.js 20 or newer (`node -v`)
- Python 3.12 (`python --version`)
- A [Neon](https://neon.tech) project
- Google Chrome, if you want to run the extension

No local Postgres install is required.

## 1. Database

In the Neon dashboard, open **Connect** and copy both strings:

- Pooled connection (hostname contains `-pooler`) → `DATABASE_URL`
- Direct connection (no `-pooler`) → `DIRECT_URL`

Keep `sslmode=require`. Do not commit either URL.

## 2. Backend

From the repo root:

```bash
cd backend
python -m venv .venv
```

Activate the virtualenv:

```bash
# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# macOS / Linux
source .venv/bin/activate
```

Then:

```bash
pip install -r requirements.txt
```

Create `backend/.env` from the example and fill in the two Neon URLs. Leave the other values unless you need to change them.

```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

`JWT_SECRET` must be at least 16 characters. For local HTTP, keep `COOKIE_SECURE=false` and `CORS_ORIGINS=http://localhost:5173`.

Apply migrations and start the API:

```bash
alembic upgrade head
uvicorn app.main:app --reload
```

The API listens on `http://127.0.0.1:8000`. `GET /health` returns `{"status":"ok"}`.

## 3. Frontend

In a second terminal, from the repo root:

```bash
cd frontend
npm install
```

Local dev does not need an API URL. Copy the example and leave `VITE_API_BASE` empty so Vite proxies `/api` to `http://127.0.0.1:8000`.

```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

```bash
npm run dev
```

Open `http://localhost:5173`, register, and sign in. Refresh the page. You should stay signed in.

## 4. Extension (optional)

From the repo root:

```bash
cd extension
npm install
npm run build
```

In Chrome, open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked**, and select `extension/dist`.

In the popup, set **API** to `http://127.0.0.1:8000`. On the website, open **Settings**, create an extension token, paste it into the popup, and click **Save token**.

`npm run build` defaults the API to localhost. `npm run package` is only for the zip published with the live site. It points the popup at the deployed API and writes `frontend/public/anime-tracker-extension.zip`.

## Environment

Backend values live in `backend/.env`. Names match `backend/.env.example`.

| Name | Local use |
|---|---|
| `DATABASE_URL` | Neon pooled URL. The API uses this. |
| `DIRECT_URL` | Neon direct URL. Alembic uses this. |
| `CORS_ORIGINS` | `http://localhost:5173` |
| `JWT_SECRET` | Random string, at least 16 characters |
| `COOKIE_SECURE` | `false` on local HTTP |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifetime. Default `15` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh cookie lifetime. Default `7` |

Frontend: `VITE_API_BASE` in `frontend/.env`. Leave it empty for `npm run dev`.

Never commit `.env` or real connection strings.

## Tests

```bash
# backend, with the virtualenv active
cd backend
pytest

# frontend
cd frontend
npm test

# extension
cd extension
npm test
```

## Production

Host layout and dashboard variables are in `docs/DEPLOY.md`.
