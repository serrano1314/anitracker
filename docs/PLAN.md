# Anime Tracker — Project Plan

> Use this file as the main context for the Cursor AI agent.
> Build **one phase at a time**. Do not jump ahead. Finish each phase's "Done when" checks before moving on.
> Do **not** add tables, routes, or UI that belong to a later phase.

---

## 1. What we are building

A website where an anime fan can:

1. Log in.
2. Search anime (data comes from a free anime API).
3. Add anime to a personal list: `watching`, `completed`, `plan_to_watch`, `on_hold`, `dropped`.
4. Track progress per episode (movies and OVAs count as 1 episode).
5. Save the websites they use to watch each anime.
6. Click an episode and get links to watch it:
   - their saved sites first,
   - if none, suggested legal streaming sites,
   - last fallback: a Google search link.
7. Use a **Chrome extension** that detects the episode being watched on other sites and saves progress automatically.

**Why:** Netflix has missing episodes (example: One Piece, around episode 811 to 1000). The user must watch elsewhere and loses progress. This app is the single place for progress, no matter where the user watches.

---

## 2. Tech stack

| Part | Choice |
|---|---|
| Frontend | React + TypeScript + Vite |
| UI / data | Tailwind CSS, TanStack Query, React Router |
| Backend | Python **3.12** FastAPI (REST), Pydantic v2 |
| ORM / migrations | SQLAlchemy 2.0 + Alembic |
| Database | **PostgreSQL** on **Neon** (dev and production). No Docker, no local Postgres. See section 15 |
| Auth | Email + password. JWT **access** token (short-lived) + **refresh** token. Separate **extension tokens** (never reuse the web JWT in the extension) |
| Anime data | **AniList GraphQL API** (free, no key needed for public data). Backup option: Jikan (MyAnimeList REST) |
| Extension | Chrome Extension, Manifest V3, TypeScript |
| Tests | pytest (backend), Vitest (frontend) |

---

## 3. Architecture

```
 [Chrome Extension] ──(extension token)──┐
                                         ▼
 [React Web App] ──(JWT + refresh)──►  [FastAPI REST API] ──► [PostgreSQL]
                                         │
                                         └──► [AniList API]  (search + cache)
```

**Important rule about anime data:**
Do NOT copy the whole anime catalog into our database.
Search AniList live, then **save (cache) an anime in our DB only when a user adds it, opens it, or the extension matches it**. This keeps the database small and free-tier friendly.

Map AniList GraphQL into **our** Pydantic schemas in the service layer. Do not leak the raw GraphQL shape to the frontend.

Re-sync a cached anime from AniList when the user **opens the detail page** (and `last_synced_at` is stale), not on every search. Long-running shows like One Piece change `total_episodes`.

---

## 4. Locked decisions (do not reopen in later phases)

These were reviewed before Phase 0. Ask before changing them.

1. **Public anime id is `anilist_id`.** The DB still has an internal UUID `anime.id`, but every REST path and frontend type uses `anilist_id`. Caching is an implementation detail.
2. **Web auth and extension auth are separate.** Web: access JWT (memory or short-lived) + refresh token in an `httpOnly` + `Secure` + `SameSite=Lax` cookie. Extension: hashed API token created in Settings, pasted into the popup. Never put the web JWT in the extension.
3. **Progress bar = watched count, not max episode.** `last_episode_watched` = highest episode number marked watched. My List shows `watched_count / total_episodes` (example: watched 1–10 and 13 → `11 / 24`, last = 13). Auto-complete only when `watched_count == total_episodes` and `total_episodes` is known. If total is unknown, never auto-complete.
4. **`mark-up-to` is one bulk, idempotent insert** (not 811 ORM `add()` calls). Unique `(user_id, anime_id, episode_number)` makes repeats a no-op.
5. **Extension never auto-adds to the library.** Match existing library titles first. If unsure, `matched: false` and the user picks. Save that pick in `extension_title_map`.
6. **Do not hardcode streaming/pirate site URLs.** Users add their own sites. Official suggestions come only from AniList `external_links`.
7. **Database is Neon Postgres for this machine.** Skip Docker Compose and a local Postgres install. Store two URLs in `.env` (never commit them): `DATABASE_URL` (pooled, hostname has `-pooler`) for the FastAPI app, `DIRECT_URL` (no `-pooler`) for Alembic migrations.

---

## 5. Project structure (monorepo)

```
anime-tracker/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/          # config, security, deps
│   │   ├── db/            # session, base
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── api/           # routers (auth, anime, library, progress, sites, extension)
│   │   └── services/      # anilist.py, watch_links.py, title_match.py
│   ├── alembic/
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   └── src/ (pages, components, api, hooks, types)
├── extension/
│   ├── manifest.json
│   └── src/ (background.ts, content.ts, popup/, parsers/)
├── docs/
│   └── PLAN.md   (this file)
└── .cursor/rules/project.mdc
```

---

## 6. Database schema (PostgreSQL)

Use UUID primary keys and `created_at` / `updated_at` on every table.

**Indexes (create with the table in that phase):**
- `anime.anilist_id` (unique, already)
- `user_anime (user_id, status)`
- `episode_progress (user_id, anime_id)`

### `users`
- `id`, `email` (unique), `username` (unique), `password_hash`

Optional later (Phase 8 if needed): hashed refresh tokens so “log out everywhere” works. v1 can use a signed refresh JWT without a table.

### `anime` (cache of AniList data)
- `id`, `anilist_id` (unique), `mal_id` (nullable)
- `title_romaji`, `title_english` (nullable), `title_synonyms` (text[])
- `cover_url`, `format` (TV, MOVIE, OVA, ONA, SPECIAL)
- `total_episodes` (nullable, because long-running shows like One Piece may be unknown)
- `airing_status`, `season_year`
- `external_links` (jsonb) — store a **trimmed** list of `{ "site": str, "url": str }`, not the raw AniList blob
- `last_synced_at`

### `user_anime` (the user's list)
- `id`, `user_id`, `anime_id`
- `status` (enum: watching, completed, plan_to_watch, on_hold, dropped)
- `score` (nullable, 1–10)
- `last_episode_watched` (int, default 0) — max episode number watched
- unique(`user_id`, `anime_id`)
- `watched_count` can be computed with `COUNT(episode_progress)` (no extra column required in v1)

### `episode_progress`
- `id`, `user_id`, `anime_id`, `episode_number`
- `watched_at`, `source_site` (nullable text)
- unique(`user_id`, `anime_id`, `episode_number`)
- Why per-episode rows: users can skip episodes (for example filler) and still see exactly what they watched.

### `user_sites` (websites a user watches on)
- `id`, `user_id`, `name`, `base_url`
- `episode_url_template` (nullable, example: `https://site.com/watch/{slug}-episode-{episode}`)
- `search_url_template` (nullable, example: `https://site.com/search?q={title}`)

**Slug rule (Phase 5 tests must pin this):** `{slug}` is lowercase English title if present, else romaji; keep `[a-z0-9]+` only; spaces become `-`. `{title}` is URL-encoded English or romaji. `{episode}` is the integer episode number.

### `user_anime_sites` (which site is used for which anime)
- `id`, `user_id`, `anime_id`, `site_id`
- `anime_url` (nullable, direct page of the anime on that site)
- unique(`user_id`, `anime_id`, `site_id`)

### `extension_tokens`
- `id`, `user_id`, `name`, `token_hash`, `last_used_at`, `revoked`
- Store only the **hash** of the token. Show the real token once when created.

### `extension_title_map` (remembers manual matches)
- `id`, `user_id`, `site_host`, `raw_title`, `anime_id`
- unique(`user_id`, `site_host`, `raw_title`)

---

## 7. REST API

Base path: `/api/v1`. All routes except register/login/refresh need auth.

Anime path parameter `{anilist_id}` is AniList’s integer id everywhere below.

### Auth
- `POST /auth/register`
- `POST /auth/login` — sets refresh cookie; returns access token
- `POST /auth/refresh` — reads refresh cookie; returns new access token
- `POST /auth/logout` — clears refresh cookie
- `GET  /auth/me`

### Anime (data from AniList, cached in DB)
- `GET /anime/search?q=&page=` — live AniList, short in-memory TTL cache, mapped to our DTO
- `GET /anime/{anilist_id}` — return cache; if missing or stale, fetch AniList, upsert, return
- `POST /anime/from-anilist/{anilist_id}` — force cache/upsert and return

### Library
- `GET    /library?status=&page=` — include `watched_count`, `last_episode_watched`, `total_episodes`
- `POST   /library` — body: `{ anilist_id, status }`
- `PATCH  /library/{anilist_id}` — update status, score
- `DELETE /library/{anilist_id}`

### Episode progress
- `GET  /library/{anilist_id}/episodes` — list of watched episode numbers
- `PUT  /library/{anilist_id}/episodes/{n}` — body: `{ watched: true|false, source_site? }`
- `POST /library/{anilist_id}/episodes/mark-up-to/{n}` — bulk upsert episodes 1..n (idempotent)
- After any change: set `last_episode_watched` to the max watched episode (0 if none). Set status to `completed` only if `watched_count == total_episodes` and total is known.

### Sites
- `GET/POST /sites`, `PATCH/DELETE /sites/{id}`
- `GET/POST /library/{anilist_id}/sites`, `DELETE /library/{anilist_id}/sites/{site_id}`

### Watch links
- `GET /anime/{anilist_id}/episodes/{n}/watch-links`
  Logic, in order:
  1. The user's saved sites for this anime. Build the link from `anime_url`, or `episode_url_template`, or `search_url_template`.
  2. If none saved: streaming links from `anime.external_links` (AniList lists official streaming services like Crunchyroll or Netflix).
  3. Always add one last item: a Google search link, `https://www.google.com/search?q=watch+{title}+episode+{n}`.
- Return a list of `{ label, url, source: "saved" | "official" | "search" }`.

### Extension
- `POST /extension/tokens` (logged-in web user creates a token)
- `GET  /extension/tokens`, `DELETE /extension/tokens/{id}`
- `POST /extension/progress` — auth by **extension token** only. Body: `{ raw_title, episode, site_host, page_url, is_movie? }`
  Backend finds the anime (see section 9), marks the episode watched, returns `{ matched: true, anime, episode }` or `{ matched: false, candidates: [...] }`.
  Do not create a `user_anime` row unless the title already maps or the user confirms via `/extension/match`.
- `POST /extension/match` — body: `{ site_host, raw_title, anilist_id }` to save a manual match.

---

## 8. Frontend pages

1. **Login / Register**
2. **My List** — tabs by status, cover, title, progress bar (`watched_count / total` or `watched_count / ?` if total unknown), "+1 episode" button
3. **Search** — search box, results from AniList, "Add to list" button
4. **Anime detail** — cover, info, status/score editor, **episode grid**
   - Click an episode number → open a small panel with watch links (section 7) and a "Mark as watched" button.
   - For long shows (1000+ episodes), group episodes in ranges (1–100, 101–200, ...) and use virtual scrolling.
   - If `total_episodes` is unknown, still allow marking and mark-up-to; show an open-ended range (e.g. 1–100, 101–200, … plus a way to jump to episode N).
   - A button "I watched up to episode ___" (uses `mark-up-to`).
   - Section "My sites for this anime" (add/remove).
5. **Settings**
   - "My watch sites" manager
   - "Extension tokens" (create, copy once, revoke)

Keep the UI simple and mobile friendly. Dark mode by default is nice for anime fans.

API calls only in `frontend/src/api`. Server state with TanStack Query. TypeScript strict, no `any`.

---

## 9. Title matching (very important for the extension)

Anime titles differ per site ("Shingeki no Kyojin" vs "Attack on Titan"). Matching order:

1. Check `extension_title_map` for (`user`, `site_host`, `raw_title`). If found, use it.
2. Clean the raw title: lowercase, remove "episode N", "english sub/dub", "watch", site name, brackets, extra spaces.
3. Fuzzy match against the **user's own library** titles (romaji, english, synonyms) using `rapidfuzz`. Accept if score is **90+**. Prefer no match over a wrong match.
4. If no library match, search AniList with the cleaned title and return the top candidates. **Cap this:** at most one AniList search per (`user`, `site_host`, `raw_title`) per day (in-memory or small cache). Do not search AniList on every page ping.
5. If still unsure, return `matched: false` and let the extension popup ask the user to pick. Save the choice in `extension_title_map` so it never asks again.

Season/cour titles ("Attack on Titan Season 2") are often separate AniList entries. Do not over-automate; `extension_title_map` is the v1 solution.

---

## 10. Chrome extension design (Manifest V3)

### How it works
1. User logs in on the website, creates an **extension token**, pastes it in the extension popup.
2. The **content script** runs on watch sites the user allowed.
3. It reads the page title / URL / headings and extracts the anime title and episode number.
4. It watches the `<video>` element. When the user passes about **80–90%** of the video (or the video ends), it sends a message to the **background service worker**.
5. The background worker calls `POST /extension/progress` with the extension token. (Doing the request in the background avoids CORS problems.)
6. The extension shows a small toast: "One Piece — Episode 812 saved ✔".

### Improvements
- **Ask for site permission only when needed.** Use `optional_host_permissions`. The popup has a button "Track this site", which calls `chrome.permissions.request` for that one site. Better privacy and no scary warning at install.
- **Detect SPA navigation** (next episode loads without full page reload): use a `MutationObserver` on the title and listen to `history.pushState` changes, then reset the tracker for the new episode.
- **Do not send twice** for the same episode in the same session.
- **Episode parsing:** try regex patterns in order: `episode\s*(\d+)`, `\bep\.?\s*(\d+)`, `\be(\d+)\b`, `-\s*(\d+)\s*$`. Each site can have its own parser file in `extension/src/parsers/` with a generic fallback.
- **Manual fallback is required, not optional.** Many players put `<video>` in a cross-origin iframe, so 85% detection will fail. Popup must have "Mark current episode" and "+1".
- **Offline / cold-start queue:** if the API is not reachable (free hosts sleep), store the event in `chrome.storage.local` and retry later.
- **Movies:** if no episode number is found and the page looks like a movie, send `is_movie: true` and use episode 1.

### Extension files
```
extension/
├── manifest.json
└── src/
    ├── background.ts      # API calls, token storage, retry queue
    ├── content.ts         # detect title/episode, watch video progress
    ├── parsers/           # generic.ts + per-site parsers
    └── popup/             # token setup, track-this-site button, manual match
```

---

## 11. Build phases (give these to Cursor one by one)

Do not create models, routes, or pages from a later phase. Phase 0 does not create `users`. Phase 3 does not build the episode grid UI.

### Phase 0 — Setup
- [ ] Create monorepo folders, `.gitignore`, `.env.example`
- [ ] Copy section 16 agent rules into `.cursor/rules/project.mdc`
- [ ] Backend: FastAPI app with `/health`, CORS, settings from env (Python 3.12)
- [ ] Connect to Neon via `DATABASE_URL` (app) and `DIRECT_URL` (Alembic). SSL required.
- [ ] Alembic configured (no business tables yet). `alembic upgrade head` against Neon using `DIRECT_URL`.
- [ ] Frontend: Vite + React + TS (strict) + Tailwind + TanStack Query + React Router
**Done when:** `GET /health` returns OK, the React app loads, and Alembic can reach Neon (`alembic current` works).

### Phase 1 — Auth
- [ ] `users` model + migration
- [ ] Register, login, refresh, logout, me
- [ ] Hash passwords with argon2 (preferred) or bcrypt
- [ ] Access token in frontend memory; refresh cookie; protected routes
**Done when:** a user can register, log in, refresh the page and stay logged in, and log out.

### Phase 2 — Anime data
- [ ] `services/anilist.py` (GraphQL client with `httpx`, timeout, error handling, one shared client)
- [ ] `anime` model + migration (including indexes)
- [ ] Search, get-by-`anilist_id`, cache from AniList; map to our DTO
- [ ] In-memory cache for search results (short TTL) + backoff on rate limits
- [ ] Re-sync on detail fetch when `last_synced_at` is stale
**Done when:** searching "One Piece" returns results, and opening one saves it in our DB.

### Phase 3 — Library and progress
- [ ] `user_anime`, `episode_progress` models + migrations
- [ ] Library CRUD
- [ ] Episode mark / unmark / mark-up-to (bulk, idempotent)
- [ ] Update `last_episode_watched` (max) and auto-complete only when `watched_count == total`
- [ ] Tests: mark, unmark, skip filler, mark-up-to, unknown `total_episodes` (must not auto-complete)
**Done when:** those tests pass.

### Phase 4 — Main frontend
- [ ] My List page (progress = watched count), Search page, Anime detail with episode grid
- [ ] Handle shows with unknown or 1000+ episodes (ranges + virtual scroll + jump to N)
**Done when:** a user can search, add One Piece, mark up to 811, and see `811 / total` (or skipped-episode counts if they skip).

### Phase 5 — Sites and watch links
- [ ] `user_sites`, `user_anime_sites` models + migrations and CRUD
- [ ] Watch-links service (saved → official → Google search)
- [ ] Frontend: site manager, per-anime sites, episode click panel
- [ ] Tests for template building (`{episode}`, `{title}`, `{slug}` per the slug rule)
**Done when:** clicking an episode shows the correct links in the correct order.

### Phase 6 — Chrome extension
- [ ] `extension_tokens`, `extension_title_map` models + migrations
- [ ] Token create / revoke on the website
- [ ] `POST /extension/progress` and `/extension/match` with title matching (library first, AniList capped)
- [ ] Extension: popup, background, content script, parsers, toast, retry queue, manual mark/+1
- [ ] Tests for title cleaning and episode parsing
**Done when:** watching a video past 85% on an allowed site **or** using manual mark saves the right episode in the web app.

### Phase 7 — Deploy (free or low cost)
- [ ] Production env vars, secure CORS, HTTPS only
- [ ] Deploy DB, backend, frontend (see section 12)
- [ ] Run Alembic migrations on deploy
- [ ] Load the extension unpacked for personal use (free)
**Done when:** the full flow works on the live URL.

For a **personal-only** deploy, Phase 7 can happen before Phase 8. If anyone else will use it, do Phase 8 first (rate limits, empty/error states).

### Phase 8 — Polish
- [ ] Rate limiting on auth and extension routes
- [ ] Error pages, loading states, empty states
- [ ] Export / import of the user's list (JSON)
- [ ] Optional: hashed refresh tokens + logout everywhere
- [ ] README with setup steps

---

## 12. Hosting and cost (aim: $0)

Free plans change often. **Check each provider's current limits before you commit.**

| Part | Free-friendly options |
|---|---|
| Frontend | Cloudflare Pages, Vercel, or Netlify (free static hosting, free `*.pages.dev` style subdomain) |
| Database | **Neon** (same project as local/dev; free Postgres) |
| Backend | Render, Koyeb, or Fly.io small free/cheap instance. Free instances may "sleep" and start slowly after idle time — the extension retry queue exists for this |
| Extension | Load unpacked = free. Chrome Web Store has a small one-time developer fee |
| Domain | Skip it. Use the free subdomain |

**About AWS (important):**
- New AWS accounts now choose a Free plan or a Paid plan. The Free plan gives about $100 in credits (up to $200 with onboarding tasks), lasts at most **6 months**, and then the account closes.
- RDS (managed PostgreSQL) has no always-free tier for new accounts.
- AWS "Always Free" items like Lambda (1M requests/month) and DynamoDB still exist, but DynamoDB does not fit this relational design.
- **Recommendation:** use AWS only if you want to learn it. For a long-term free project, use the options in the table. If you do use AWS, set a billing alert on day one.

---

## 13. Why PostgreSQL and not Oracle

- Works great with FastAPI + SQLAlchemy + Alembic.
- Free managed options are easy to find (Neon, Supabase).
- Oracle adds licensing, setup, and driver complexity with no benefit for this project.

---

## 14. Security and legal notes

- Never store plain passwords. Never log tokens or passwords.
- Extension tokens: store hash only, allow revoke. Separate from web JWTs.
- Validate all input with Pydantic. Use parameterized queries (SQLAlchemy does this).
- CORS: allow only the real frontend origin in production.
- Rate limit login and extension endpoints (Phase 8; required before a shared deploy).
- The extension must only read the page when the user enabled that site. Collect only: title, episode, site host, page URL.
- This app **tracks progress and links to sites the user chooses**. It does not host, stream, or download videos. The app does not hardcode any piracy sites. Users add their own sites. Suggested sites come from AniList's official streaming links.
- Follow the AniList API terms of use and cache responses to avoid abuse.

---

## 15. Local machine setup (before Phase 0)

Already assumed: Git, npm (Node.js), VS Code or Cursor.

**Install these:**

| Software | Why | Notes |
|---|---|---|
| **Node.js 20 LTS** (or 22) | Vite frontend + extension tooling | You have npm; confirm `node -v` is **≥ 20**. If it is 18 or older, upgrade |
| **Python 3.12** | FastAPI backend | Install from python.org. Tick **“Add python.exe to PATH”**. Then `python --version` should print 3.12.x |
| **Google Chrome** | Load the unpacked extension in Phase 6 | Edge can work later; Chrome is the target |
| **Neon account** | Hosted Postgres (dev + prod) | Free. See steps below. No Docker, no local Postgres |

**Do not install:** Docker Desktop, WSL, PostgreSQL for Windows.

**Nice to have in the editor:** Python extension, ESLint, Tailwind IntelliSense. Not required to start.

**After install, sanity check in a terminal:**

```text
git --version
node -v          # >= 20
npm -v
python --version # 3.12.x
```

### Neon account (do this before Phase 0)

1. Open [https://console.neon.tech](https://console.neon.tech) and sign up (GitHub is fine).
2. Create a project:
   - Name: `anime-tracker`
   - Region: pick the closest (for the Philippines, `ap-southeast-1` Singapore or `ap-southeast-2` Sydney if offered)
   - Postgres version: default (16 or 17 is fine)
3. When the project opens, click **Connect**.
4. Copy **two** connection strings (same modal; toggle **Connection pooling**):
   - **Pooled ON** (hostname contains `-pooler`) → this is `DATABASE_URL`
   - **Pooled OFF** (no `-pooler`) → this is `DIRECT_URL`
5. Keep `sslmode=require` (and `channel_binding=require` if Neon includes it).
6. You will paste both into `backend/.env` in Phase 0. Never commit `.env`. `.env.example` will have empty placeholders only.

Free-tier compute **sleeps after idle**. The first request after a pause can take a few seconds. That is expected. The Chrome extension retry queue (Phase 6) exists partly for this.

Do not paste real passwords into chat. If a future agent needs to test the DB, say “Neon is ready” and keep the URL in `.env` only.

---

## 16. Rules for the Cursor agent

Copy this into `.cursor/rules/project.mdc` during Phase 0:

```
- Stack: FastAPI (Python 3.12), SQLAlchemy 2.0, Alembic, PostgreSQL on Neon, React + TypeScript + Vite, Tailwind, TanStack Query.
- DATABASE_URL = Neon pooled. DIRECT_URL = Neon direct (Alembic). Never commit .env.
- Follow docs/PLAN.md. Work on ONE phase at a time. Do not add tables, routes, or UI from a later phase.
- Ask before changing the schema, API, or locked decisions in section 4.
- Public anime id is anilist_id. Web JWT and extension tokens stay separate.
- Backend: routers in app/api, business logic in app/services, no logic inside routers beyond validation.
- Always use Pydantic schemas for request and response. Use type hints everywhere.
- Every DB change needs an Alembic migration.
- Write tests for services (progress rules, title matching, watch links).
- Frontend: TypeScript strict mode, no `any`, API calls only inside src/api, server data with TanStack Query.
- Never commit secrets. Use .env and keep .env.example updated.
- Keep code simple and readable. Small functions, clear names.
```

**Prompt template for each phase:**
> "Read docs/PLAN.md. Implement **Phase N** only. List the files you will create or change first, then do the work. Add tests. Tell me how to run and check it."

---

## 17. Future ideas (after the first version)

- Import from MyAnimeList / AniList lists
- "New episode aired" reminders from AniList airing data
- Firefox support (WebExtension API, same code with a small polyfill)
- Public profile page to share your list
- Stats page (hours watched, genres)
