import hashlib
import secrets
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.anime import Anime
from app.models.extension import ExtensionTitleMap, ExtensionToken
from app.models.library import UserAnime
from app.models.user import User
from app.schemas.anime import AnimeData
from app.schemas.extension import (
    ExtensionAnimeBrief,
    ExtensionMatchResponse,
    ExtensionProgressMatched,
    ExtensionProgressResponse,
    ExtensionProgressUnmatched,
)
from app.schemas.library import LibraryStatus
from app.services.anime import AnimeSource, get_anime
from app.services.anilist import get_anilist_client
from app.services.progress import set_episode_watched
from app.services.title_match import (
    CANDIDATE_LIMIT,
    LibraryTitle,
    TitleSearchCache,
    best_library_match,
    clean_title,
    get_title_search_cache,
    normalize_host,
)


def hash_extension_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_extension_token(db: Session, user: User, name: str) -> tuple[ExtensionToken, str]:
    raw = secrets.token_urlsafe(32)
    row = ExtensionToken(
        user_id=user.id,
        name=name.strip(),
        token_hash=hash_extension_token(raw),
        revoked=False,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row, raw


def list_extension_tokens(db: Session, user: User) -> list[ExtensionToken]:
    rows = db.scalars(
        select(ExtensionToken)
        .where(ExtensionToken.user_id == user.id, ExtensionToken.revoked.is_(False))
        .order_by(ExtensionToken.created_at.desc(), ExtensionToken.id.asc())
    ).all()
    return list(rows)


def revoke_extension_token(db: Session, user: User, token_id: UUID) -> None:
    row = db.scalar(
        select(ExtensionToken).where(
            ExtensionToken.id == token_id,
            ExtensionToken.user_id == user.id,
            ExtensionToken.revoked.is_(False),
        )
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Extension token not found")
    row.revoked = True
    db.commit()


def authenticate_extension_token(db: Session, token: str) -> User | None:
    cleaned = token.strip()
    if not cleaned:
        return None
    row = db.scalar(
        select(ExtensionToken).where(
            ExtensionToken.token_hash == hash_extension_token(cleaned),
            ExtensionToken.revoked.is_(False),
        )
    )
    if row is None:
        return None
    row.last_used_at = datetime.now(timezone.utc)
    user = db.get(User, row.user_id)
    db.commit()
    return user


def record_extension_progress(
    db: Session,
    user: User,
    *,
    raw_title: str,
    episode: int | None,
    site_host: str,
    is_movie: bool,
    client: AnimeSource | None = None,
    search_cache: TitleSearchCache | None = None,
    now: datetime | None = None,
) -> ExtensionProgressResponse:
    episode_number = _episode_number(episode, is_movie)
    host = _host_or_422(site_host)
    current = now or datetime.now(timezone.utc)
    cache = search_cache or get_title_search_cache()

    mapped = _mapped_anime(db, user, host, raw_title)
    if mapped is not None and _in_library(db, user, mapped):
        return _mark(db, user, mapped, episode_number, host)

    if mapped is not None:
        return ExtensionProgressUnmatched(matched=False, candidates=[_brief(mapped)])

    cleaned = clean_title(raw_title, host)
    library_id = best_library_match(cleaned, _library_titles(db, user))
    if library_id is not None:
        anime = db.scalar(select(Anime).where(Anime.anilist_id == library_id))
        if anime is not None and _in_library(db, user, anime):
            return _mark(db, user, anime, episode_number, host)

    candidates = _search_candidates(
        user,
        host=host,
        raw_title=raw_title,
        cleaned=cleaned,
        client=client,
        cache=cache,
        now=current,
    )
    return ExtensionProgressUnmatched(matched=False, candidates=candidates)


def confirm_extension_match(
    db: Session,
    user: User,
    *,
    site_host: str,
    raw_title: str,
    anilist_id: int,
    client: AnimeSource | None = None,
) -> ExtensionMatchResponse:
    host = _host_or_422(site_host)
    source = client or get_anilist_client()
    anime = get_anime(db, anilist_id, client=source)
    _save_title_map(db, user, host, raw_title, anime)
    _ensure_library(db, user, anime)
    return ExtensionMatchResponse(
        anilist_id=anime.anilist_id,
        title_romaji=anime.title_romaji,
        title_english=anime.title_english,
        site_host=host,
        raw_title=raw_title,
    )


def _episode_number(episode: int | None, is_movie: bool) -> int:
    if episode is not None:
        return episode
    if is_movie:
        return 1
    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Episode number is required")


def _host_or_422(site_host: str) -> str:
    try:
        return normalize_host(site_host)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Site host is required",
        ) from None


def _mapped_anime(db: Session, user: User, host: str, raw_title: str) -> Anime | None:
    return db.scalar(
        select(Anime)
        .join(ExtensionTitleMap, ExtensionTitleMap.anime_id == Anime.id)
        .where(
            ExtensionTitleMap.user_id == user.id,
            ExtensionTitleMap.site_host == host,
            ExtensionTitleMap.raw_title == raw_title,
        )
    )


def _in_library(db: Session, user: User, anime: Anime) -> bool:
    entry_id = db.scalar(
        select(UserAnime.id).where(UserAnime.user_id == user.id, UserAnime.anime_id == anime.id)
    )
    return entry_id is not None


def _library_titles(db: Session, user: User) -> list[LibraryTitle]:
    rows = db.scalars(
        select(Anime).join(UserAnime, UserAnime.anime_id == Anime.id).where(UserAnime.user_id == user.id)
    ).all()
    titles: list[LibraryTitle] = []
    for anime in rows:
        names = [anime.title_romaji]
        if anime.title_english:
            names.append(anime.title_english)
        names.extend(anime.title_synonyms or [])
        cleaned = tuple(dict.fromkeys(text for name in names if (text := clean_title(name))))
        titles.append(LibraryTitle(anilist_id=anime.anilist_id, titles=cleaned))
    return titles


def _search_candidates(
    user: User,
    *,
    host: str,
    raw_title: str,
    cleaned: str,
    client: AnimeSource | None,
    cache: TitleSearchCache,
    now: datetime,
) -> list[ExtensionAnimeBrief]:
    if not cleaned:
        return []
    key = (str(user.id), host, raw_title)
    cached = cache.get(key, now)
    if cached is not None:
        return [_brief_data(item) for item in cached[:CANDIDATE_LIMIT]]
    source = client or get_anilist_client()
    result = source.search(cleaned, 1)
    cache.set(key, result.results, now)
    return [_brief_data(item) for item in result.results[:CANDIDATE_LIMIT]]


def _mark(
    db: Session,
    user: User,
    anime: Anime,
    episode_number: int,
    host: str,
) -> ExtensionProgressMatched:
    set_episode_watched(
        db,
        user,
        anime.anilist_id,
        episode_number,
        watched=True,
        source_site=host,
    )
    db.refresh(anime)
    return ExtensionProgressMatched(matched=True, anime=_brief(anime), episode=episode_number)


def _ensure_library(db: Session, user: User, anime: Anime) -> None:
    if _in_library(db, user, anime):
        return
    db.add(
        UserAnime(
            user_id=user.id,
            anime_id=anime.id,
            status=LibraryStatus.watching.value,
            last_episode_watched=0,
        )
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()


def _save_title_map(db: Session, user: User, host: str, raw_title: str, anime: Anime) -> None:
    row = db.scalar(
        select(ExtensionTitleMap).where(
            ExtensionTitleMap.user_id == user.id,
            ExtensionTitleMap.site_host == host,
            ExtensionTitleMap.raw_title == raw_title,
        )
    )
    if row is None:
        db.add(
            ExtensionTitleMap(
                user_id=user.id,
                site_host=host,
                raw_title=raw_title,
                anime_id=anime.id,
            )
        )
    else:
        row.anime_id = anime.id
    db.commit()


def _brief(anime: Anime) -> ExtensionAnimeBrief:
    return ExtensionAnimeBrief(
        anilist_id=anime.anilist_id,
        title_romaji=anime.title_romaji,
        title_english=anime.title_english,
        cover_url=anime.cover_url,
        format=anime.format,
        total_episodes=anime.total_episodes,
    )


def _brief_data(data: AnimeData) -> ExtensionAnimeBrief:
    return ExtensionAnimeBrief(
        anilist_id=data.anilist_id,
        title_romaji=data.title_romaji,
        title_english=data.title_english,
        cover_url=data.cover_url,
        format=data.format,
        total_episodes=data.total_episodes,
    )
