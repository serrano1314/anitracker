from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import event, func, select
from sqlalchemy.orm import Session

from app.models.anime import Anime
from app.models.library import EpisodeProgress, UserAnime
from app.models.user import User
from app.schemas.library import LibraryStatus
from app.services.library import add_to_library
from app.services.progress import mark_up_to, set_episode_watched


def _user(db: Session, username: str = "steven") -> User:
    user = User(email=f"{username}@example.com", username=username, password_hash="hash")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _anime(db: Session, *, anilist_id: int = 21, total: int | None = 24) -> Anime:
    anime = Anime(
        anilist_id=anilist_id,
        title_romaji="One Piece",
        title_english="One Piece",
        title_synonyms=[],
        external_links=[],
        format="TV",
        total_episodes=total,
        last_synced_at=datetime.now(timezone.utc),
    )
    db.add(anime)
    db.commit()
    db.refresh(anime)
    return anime


def _watching(db: Session, user: User, anime: Anime) -> None:
    add_to_library(db, user, anime.anilist_id, LibraryStatus.watching)


def _count(db: Session, user_id: UUID, anime_id: UUID) -> int:
    total = db.scalar(
        select(func.count())
        .select_from(EpisodeProgress)
        .where(EpisodeProgress.user_id == user_id, EpisodeProgress.anime_id == anime_id)
    )
    return int(total or 0)


def test_mark_sets_last_episode_and_stores_source(db: Session) -> None:
    user = _user(db)
    anime = _anime(db, total=24)
    _watching(db, user, anime)

    state = set_episode_watched(
        db,
        user,
        21,
        12,
        watched=True,
        source_site=" crunchyroll ",
    )

    assert state.watched_count == 1
    assert state.last_episode_watched == 12
    assert state.status == LibraryStatus.watching
    row = db.scalar(select(EpisodeProgress).where(EpisodeProgress.episode_number == 12))
    assert row is not None
    assert row.source_site == "crunchyroll"


def test_mark_same_episode_twice_is_a_no_op(db: Session) -> None:
    user = _user(db)
    anime = _anime(db, total=24)
    _watching(db, user, anime)
    set_episode_watched(db, user, 21, 4, watched=True, source_site="first")
    set_episode_watched(db, user, 21, 4, watched=True, source_site="second")

    assert _count(db, user.id, anime.id) == 1
    row = db.scalar(select(EpisodeProgress))
    assert row is not None
    assert row.source_site == "first"


def test_unmark_recomputes_max_episode(db: Session) -> None:
    user = _user(db)
    anime = _anime(db, total=24)
    _watching(db, user, anime)
    set_episode_watched(db, user, 21, 2, watched=True, source_site=None)
    set_episode_watched(db, user, 21, 5, watched=True, source_site=None)

    state = set_episode_watched(db, user, 21, 5, watched=False, source_site=None)
    assert state.watched_count == 1
    assert state.last_episode_watched == 2
    assert state.status == LibraryStatus.watching

    cleared = set_episode_watched(db, user, 21, 2, watched=False, source_site=None)
    assert cleared.watched_count == 0
    assert cleared.last_episode_watched == 0

    again = set_episode_watched(db, user, 21, 2, watched=False, source_site=None)
    assert again.watched_count == 0
    assert again.last_episode_watched == 0


def test_skip_filler_uses_watched_count_and_max_episode(db: Session) -> None:
    user = _user(db)
    anime = _anime(db, total=24)
    _watching(db, user, anime)

    mark_up_to(db, user, 21, 10)
    state = set_episode_watched(db, user, 21, 13, watched=True, source_site=None)

    assert state.watched_count == 11
    assert state.last_episode_watched == 13
    assert state.status == LibraryStatus.watching
    assert state.total_episodes == 24


def test_mark_up_to_is_one_idempotent_insert(db: Session) -> None:
    user = _user(db)
    anime = _anime(db, total=1155)
    _watching(db, user, anime)
    inserts: list[str] = []

    def before_cursor_execute(
        _conn: object,
        _cursor: object,
        statement: str,
        _parameters: object,
        _context: object,
        _executemany: bool,
    ) -> None:
        if statement.lstrip().upper().startswith("INSERT") and "episode_progress" in statement:
            inserts.append(statement)

    engine = db.get_bind()
    event.listen(engine, "before_cursor_execute", before_cursor_execute)
    try:
        first = mark_up_to(db, user, 21, 811)
        second = mark_up_to(db, user, 21, 811)
    finally:
        event.remove(engine, "before_cursor_execute", before_cursor_execute)

    assert first.watched_count == 811
    assert first.last_episode_watched == 811
    assert first.status == LibraryStatus.watching
    assert second.watched_count == 811
    assert second.last_episode_watched == 811
    assert _count(db, user.id, anime.id) == 811
    assert len(inserts) == 2
    assert "executemany" not in inserts[0].lower()


def test_unknown_total_does_not_auto_complete(db: Session) -> None:
    user = _user(db)
    anime = _anime(db, total=None)
    _watching(db, user, anime)

    state = mark_up_to(db, user, 21, 40)

    assert anime.total_episodes is None
    assert state.watched_count == 40
    assert state.last_episode_watched == 40
    assert state.status == LibraryStatus.watching
    entry = db.scalar(select(UserAnime).where(UserAnime.user_id == user.id))
    assert entry is not None
    assert entry.status == "watching"


def test_auto_complete_only_when_watched_count_equals_total(db: Session) -> None:
    user = _user(db)
    anime = _anime(db, total=3)
    _watching(db, user, anime)

    partial = set_episode_watched(db, user, 21, 1, watched=True, source_site=None)
    set_episode_watched(db, user, 21, 3, watched=True, source_site=None)
    entry = db.scalar(select(UserAnime).where(UserAnime.user_id == user.id))
    assert partial.status == LibraryStatus.watching
    assert entry is not None
    assert entry.status == "watching"
    assert entry.last_episode_watched == 3

    finished = set_episode_watched(db, user, 21, 2, watched=True, source_site=None)
    assert finished.watched_count == 3
    assert finished.last_episode_watched == 3
    assert finished.status == LibraryStatus.completed


def test_extra_episodes_beyond_total_do_not_auto_complete(db: Session) -> None:
    user = _user(db)
    anime = _anime(db, total=2)
    _watching(db, user, anime)

    state = mark_up_to(db, user, 21, 3)

    assert state.watched_count == 3
    assert state.last_episode_watched == 3
    assert state.status == LibraryStatus.watching


def test_movie_completes_when_the_single_episode_is_watched(db: Session) -> None:
    user = _user(db)
    anime = _anime(db, anilist_id=100, total=1)
    anime.format = "MOVIE"
    anime.title_romaji = "A Movie"
    db.commit()
    _watching(db, user, anime)

    state = set_episode_watched(db, user, 100, 1, watched=True, source_site=None)

    assert state.watched_count == 1
    assert state.status == LibraryStatus.completed
