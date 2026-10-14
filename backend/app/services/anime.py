from datetime import datetime, timedelta, timezone
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.anime import Anime
from app.schemas.anime import AnimeData, AnimeSearchResponse
from app.services.anilist import get_anilist_client


class AnimeSource(Protocol):
    def search(self, query: str, page: int) -> AnimeSearchResponse: ...

    def fetch_media(self, anilist_id: int) -> AnimeData: ...


def search_anime(
    query: str,
    page: int,
    client: AnimeSource | None = None,
) -> AnimeSearchResponse:
    anilist = client or get_anilist_client()
    return anilist.search(query, page)


def get_anime(
    db: Session,
    anilist_id: int,
    *,
    force: bool = False,
    client: AnimeSource | None = None,
    now: datetime | None = None,
) -> Anime:
    current = now or datetime.now(timezone.utc)
    cached = db.scalar(select(Anime).where(Anime.anilist_id == anilist_id))
    if cached is not None and not force and _is_fresh(cached, current):
        return cached

    anilist = client or get_anilist_client()
    return upsert_anime(db, anilist.fetch_media(anilist_id), synced_at=current)


def upsert_anime(db: Session, data: AnimeData, *, synced_at: datetime | None = None) -> Anime:
    row = db.scalar(select(Anime).where(Anime.anilist_id == data.anilist_id))
    if row is None:
        row = Anime(anilist_id=data.anilist_id, last_synced_at=synced_at or datetime.now(timezone.utc))
        db.add(row)

    row.mal_id = data.mal_id
    row.title_romaji = data.title_romaji
    row.title_english = data.title_english
    row.title_synonyms = list(data.title_synonyms)
    row.cover_url = data.cover_url
    row.format = data.format
    row.total_episodes = data.total_episodes
    row.airing_status = data.airing_status
    row.season_year = data.season_year
    row.external_links = [link.model_dump() for link in data.external_links]
    row.last_synced_at = synced_at or datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return row


def _is_fresh(anime: Anime, now: datetime) -> bool:
    ttl = timedelta(hours=get_settings().ANIME_SYNC_TTL_HOURS)
    synced = anime.last_synced_at
    if synced.tzinfo is None:
        synced = synced.replace(tzinfo=timezone.utc)
    else:
        synced = synced.astimezone(timezone.utc)
    current = now if now.tzinfo is not None else now.replace(tzinfo=timezone.utc)
    return current - synced < ttl
