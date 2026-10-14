from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models.anime import Anime
from app.models.library import EpisodeProgress, UserAnime
from app.models.user import User
from app.schemas.library import LibraryStatus, ProgressStateResponse, WatchedEpisodesResponse
from app.services.library import get_library_entry

MAX_EPISODE_NUMBER = 5000


def list_watched_episodes(db: Session, user: User, anilist_id: int) -> WatchedEpisodesResponse:
    _entry, anime = get_library_entry(db, user.id, anilist_id)
    numbers = db.scalars(
        select(EpisodeProgress.episode_number)
        .where(EpisodeProgress.user_id == user.id, EpisodeProgress.anime_id == anime.id)
        .order_by(EpisodeProgress.episode_number.asc())
    ).all()
    return WatchedEpisodesResponse(anilist_id=anime.anilist_id, episodes=list(numbers))


def set_episode_watched(
    db: Session,
    user: User,
    anilist_id: int,
    episode_number: int,
    *,
    watched: bool,
    source_site: str | None,
) -> ProgressStateResponse:
    entry, anime = get_library_entry(db, user.id, anilist_id)
    if watched:
        _insert_episodes(
            db,
            [
                _episode_row(
                    user.id,
                    anime.id,
                    episode_number,
                    source_site=_clean_source(source_site),
                )
            ],
        )
    else:
        db.execute(
            delete(EpisodeProgress).where(
                EpisodeProgress.user_id == user.id,
                EpisodeProgress.anime_id == anime.id,
                EpisodeProgress.episode_number == episode_number,
            )
        )
    watched_count = _sync_progress(db, entry, anime)
    db.commit()
    db.refresh(entry)
    return _progress_state(anime, entry, watched_count)


def mark_up_to(db: Session, user: User, anilist_id: int, episode_number: int) -> ProgressStateResponse:
    entry, anime = get_library_entry(db, user.id, anilist_id)
    rows = [
        _episode_row(user.id, anime.id, number, source_site=None)
        for number in range(1, episode_number + 1)
    ]
    _insert_episodes(db, rows)
    watched_count = _sync_progress(db, entry, anime)
    db.commit()
    db.refresh(entry)
    return _progress_state(anime, entry, watched_count)


def _sync_progress(db: Session, entry: UserAnime, anime: Anime) -> int:
    db.flush()
    watched_count, highest = db.execute(
        select(
            func.count(EpisodeProgress.id),
            func.max(EpisodeProgress.episode_number),
        ).where(
            EpisodeProgress.user_id == entry.user_id,
            EpisodeProgress.anime_id == entry.anime_id,
        )
    ).one()
    count = int(watched_count or 0)
    entry.last_episode_watched = int(highest or 0)
    if _should_auto_complete(anime.total_episodes, count):
        entry.status = LibraryStatus.completed.value
    return count


def _should_auto_complete(total_episodes: int | None, watched_count: int) -> bool:
    if total_episodes is None or total_episodes < 1:
        return False
    return watched_count == total_episodes


def _insert_episodes(db: Session, rows: list[dict[str, object]]) -> None:
    if not rows:
        return
    dialect_name = db.get_bind().dialect.name
    if dialect_name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert as dialect_insert
    else:
        from sqlalchemy.dialects.sqlite import insert as dialect_insert
    statement = dialect_insert(EpisodeProgress).values(rows)
    statement = statement.on_conflict_do_nothing(
        index_elements=["user_id", "anime_id", "episode_number"]
    )
    db.execute(statement)


def _episode_row(
    user_id: UUID,
    anime_id: UUID,
    episode_number: int,
    *,
    source_site: str | None,
) -> dict[str, object]:
    now = datetime.now(timezone.utc)
    return {
        "id": uuid4(),
        "user_id": user_id,
        "anime_id": anime_id,
        "episode_number": episode_number,
        "watched_at": now,
        "source_site": source_site,
        "created_at": now,
        "updated_at": now,
    }


def _clean_source(source_site: str | None) -> str | None:
    if source_site is None:
        return None
    cleaned = source_site.strip()
    return cleaned or None


def _progress_state(anime: Anime, entry: UserAnime, watched_count: int) -> ProgressStateResponse:
    return ProgressStateResponse(
        anilist_id=anime.anilist_id,
        watched_count=watched_count,
        last_episode_watched=entry.last_episode_watched,
        status=LibraryStatus(entry.status),
        total_episodes=anime.total_episodes,
    )
