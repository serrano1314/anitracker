from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.anime import Anime
from app.models.extension import ExtensionToken
from app.models.library import EpisodeProgress, UserAnime
from app.schemas.anime import AnimeData, AnimeSearchResponse
from app.services.anilist import AniListUnavailable
from app.services.extension import hash_extension_token
from app.services.title_match import get_title_search_cache
from tests.test_library_api import _auth, _cache

RAW_TITLE = "Watch One Piece Episode 812 English Sub - 9anime"


class FakeAniList:
    def __init__(self, results: list[AnimeData] | None = None) -> None:
        self.searches = 0
        self.fetches = 0
        self.results = results or []

    def search(self, query: str, page: int) -> AnimeSearchResponse:
        self.searches += 1
        return AnimeSearchResponse(page=page, has_next_page=False, results=self.results)

    def fetch_media(self, anilist_id: int) -> AnimeData:
        self.fetches += 1
        for item in self.results:
            if item.anilist_id == anilist_id:
                return item
        return AnimeData(
            anilist_id=anilist_id,
            title_romaji="Fetched",
            title_english="Fetched",
            format="TV",
            total_episodes=12,
        )


class UnavailableAniList(FakeAniList):
    def search(self, query: str, page: int) -> AnimeSearchResponse:
        self.searches += 1
        raise AniListUnavailable("down")


@pytest.fixture(autouse=True)
def clear_search_cache() -> None:
    get_title_search_cache().clear()


def _extension_token(client: TestClient, headers: dict[str, str], name: str = "Chrome") -> str:
    created = client.post("/api/v1/extension/tokens", json={"name": name}, headers=headers)
    assert created.status_code == 201
    body = created.json()
    assert body["token"]
    assert body["name"] == name
    return str(body["token"])


def _add(client: TestClient, headers: dict[str, str], anilist_id: int = 21) -> None:
    created = client.post(
        "/api/v1/library",
        json={"anilist_id": anilist_id, "status": "watching"},
        headers=headers,
    )
    assert created.status_code == 201


def _progress(
    client: TestClient,
    token: str,
    *,
    raw_title: str = RAW_TITLE,
    episode: int | None = 812,
    site_host: str = "https://www.9anime.to/watch",
    is_movie: bool = False,
) -> object:
    body: dict[str, object] = {
        "raw_title": raw_title,
        "site_host": site_host,
        "page_url": "https://9anime.to/watch/one-piece",
        "is_movie": is_movie,
    }
    if episode is not None:
        body["episode"] = episode
    return client.post(
        "/api/v1/extension/progress",
        json=body,
        headers={"Authorization": f"Bearer {token}"},
    )


def test_extension_tokens_are_hashed_listed_without_secret_and_revocable(
    client: TestClient,
    db: Session,
) -> None:
    headers = _auth(client)
    token = _extension_token(client, headers)
    stored = db.scalar(select(ExtensionToken))
    assert stored is not None
    assert stored.token_hash == hash_extension_token(token)
    assert stored.token_hash != token
    assert token not in stored.token_hash

    listed = client.get("/api/v1/extension/tokens", headers=headers)
    assert listed.status_code == 200
    payload = listed.json()
    assert len(payload) == 1
    assert "token" not in payload[0]
    assert payload[0]["revoked"] is False

    removed = client.delete(f"/api/v1/extension/tokens/{payload[0]['id']}", headers=headers)
    assert removed.status_code == 204
    assert client.get("/api/v1/extension/tokens", headers=headers).json() == []
    assert _progress(client, token).status_code == 401


def test_progress_requires_extension_token_not_web_jwt(client: TestClient, db: Session) -> None:
    _cache(db)
    headers = _auth(client)
    _add(client, headers)
    web = client.post(
        "/api/v1/extension/progress",
        json={
            "raw_title": RAW_TITLE,
            "episode": 1,
            "site_host": "9anime.to",
            "page_url": "https://9anime.to/watch",
        },
        headers=headers,
    )
    assert web.status_code == 401
    assert client.get("/api/v1/extension/tokens").status_code == 401


def test_library_title_match_marks_one_episode(client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    _cache(db, total=1155)
    headers = _auth(client)
    _add(client, headers)
    fake = FakeAniList()
    monkeypatch.setattr("app.services.extension.get_anilist_client", lambda: fake)
    token = _extension_token(client, headers)

    saved = _progress(client, token)
    assert saved.status_code == 200
    body = saved.json()
    assert body["matched"] is True
    assert body["episode"] == 812
    assert body["anime"]["anilist_id"] == 21
    assert body["anime"]["title_romaji"] == "One Piece"
    assert fake.searches == 0

    again = _progress(client, token)
    assert again.status_code == 200
    assert db.scalar(select(func.count()).select_from(EpisodeProgress)) == 1
    row = db.scalar(select(EpisodeProgress))
    assert row is not None
    assert row.episode_number == 812
    assert row.source_site == "9anime.to"
    entry = db.scalar(select(UserAnime))
    assert entry is not None
    assert entry.last_episode_watched == 812
    assert entry.status == "watching"


def test_synonym_match_and_movie_episode(client: TestClient, db: Session) -> None:
    anime = _cache(db, anilist_id=16498, total=25)
    anime.title_romaji = "Shingeki no Kyojin"
    anime.title_english = None
    anime.title_synonyms = ["Attack on Titan"]
    movie = Anime(
        anilist_id=164,
        title_romaji="A Movie",
        title_english="A Movie",
        title_synonyms=[],
        format="MOVIE",
        total_episodes=1,
        external_links=[],
        last_synced_at=datetime.now(timezone.utc),
    )
    db.add(movie)
    db.commit()
    headers = _auth(client)
    _add(client, headers, 16498)
    _add(client, headers, 164)
    token = _extension_token(client, headers)

    saved = _progress(client, token, raw_title="Attack on Titan Episode 1 [English Dub]", episode=1)
    assert saved.status_code == 200
    assert saved.json()["anime"]["anilist_id"] == 16498

    film = _progress(
        client,
        token,
        raw_title="A Movie (Film)",
        episode=None,
        site_host="example.com",
        is_movie=True,
    )
    assert film.status_code == 200
    assert film.json()["matched"] is True
    assert film.json()["episode"] == 1
    assert film.json()["anime"]["anilist_id"] == 164
    entry = db.scalar(select(UserAnime).where(UserAnime.anime_id == movie.id))
    assert entry is not None
    assert entry.status == "completed"


def test_unknown_title_does_not_add_to_library_and_searches_anilist_once(
    client: TestClient,
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    headers = _auth(client)
    fake = FakeAniList(
        [
            AnimeData(anilist_id=21, title_romaji="One Piece", title_english="One Piece", total_episodes=1155),
            AnimeData(anilist_id=22, title_romaji="One Piece Film: Red", total_episodes=1),
        ]
    )
    monkeypatch.setattr("app.services.extension.get_anilist_client", lambda: fake)
    token = _extension_token(client, headers)

    first = _progress(client, token)
    assert first.status_code == 200
    body = first.json()
    assert body["matched"] is False
    assert [item["anilist_id"] for item in body["candidates"]] == [21, 22]
    assert db.scalar(select(func.count()).select_from(UserAnime)) == 0
    assert db.scalar(select(func.count()).select_from(EpisodeProgress)) == 0

    second = _progress(client, token)
    assert second.status_code == 200
    assert second.json()["candidates"][0]["anilist_id"] == 21
    assert fake.searches == 1

    other = _progress(client, token, raw_title="Naruto Episode 1")
    assert other.status_code == 200
    assert fake.searches == 2


def test_failed_anilist_search_is_not_cached(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    headers = _auth(client)
    fake = UnavailableAniList()
    monkeypatch.setattr("app.services.extension.get_anilist_client", lambda: fake)
    token = _extension_token(client, headers)

    assert _progress(client, token).status_code == 502
    assert _progress(client, token).status_code == 502
    assert fake.searches == 2


def test_ambiguous_library_titles_are_not_marked(client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    first = _cache(db, anilist_id=1, total=12)
    first.title_romaji = "Alpha Show"
    first.title_english = "Alpha Show"
    second = Anime(
        anilist_id=2,
        title_romaji="Beta Show",
        title_english="Beta",
        title_synonyms=["Alpha Show"],
        format="TV",
        total_episodes=12,
        external_links=[],
        last_synced_at=datetime.now(timezone.utc),
    )
    db.add(second)
    db.commit()
    headers = _auth(client)
    _add(client, headers, 1)
    _add(client, headers, 2)
    fake = FakeAniList([AnimeData(anilist_id=99, title_romaji="Alpha Show")])
    monkeypatch.setattr("app.services.extension.get_anilist_client", lambda: fake)
    token = _extension_token(client, headers)

    saved = _progress(client, token, raw_title="Alpha Show Episode 3", episode=3)
    assert saved.status_code == 200
    assert saved.json()["matched"] is False
    assert db.scalar(select(func.count()).select_from(EpisodeProgress)) == 0
    assert fake.searches == 1


def test_manual_match_adds_to_library_then_progress_saves(
    client: TestClient,
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    headers = _auth(client)
    fake = FakeAniList(
        [AnimeData(anilist_id=21, title_romaji="One Piece", title_english="One Piece", format="TV", total_episodes=1155)]
    )
    monkeypatch.setattr("app.services.extension.get_anilist_client", lambda: fake)
    token = _extension_token(client, headers)
    extension_headers = {"Authorization": f"Bearer {token}"}

    matched = client.post(
        "/api/v1/extension/match",
        json={"site_host": "www.9anime.to", "raw_title": RAW_TITLE, "anilist_id": 21},
        headers=extension_headers,
    )
    assert matched.status_code == 200
    assert matched.json()["anilist_id"] == 21
    assert matched.json()["site_host"] == "9anime.to"
    assert fake.fetches == 1
    assert db.scalar(select(func.count()).select_from(UserAnime)) == 1

    saved = _progress(client, token)
    assert saved.status_code == 200
    assert saved.json()["matched"] is True
    assert saved.json()["episode"] == 812
    assert fake.searches == 0

    removed = client.delete("/api/v1/library/21", headers=headers)
    assert removed.status_code == 204
    held = _progress(client, token)
    assert held.status_code == 200
    assert held.json()["matched"] is False
    assert held.json()["candidates"][0]["anilist_id"] == 21
    assert db.scalar(select(func.count()).select_from(UserAnime)) == 0


def test_progress_requires_an_episode_number(client: TestClient) -> None:
    headers = _auth(client)
    token = _extension_token(client, headers)
    missing = _progress(client, token, episode=None, is_movie=False)
    assert missing.status_code == 422


def test_search_cap_expires_after_one_day(db: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.models.user import User
    from app.services.extension import record_extension_progress

    user = User(email="cap@example.com", username="cap", password_hash="hash")
    db.add(user)
    db.commit()
    fake = FakeAniList([AnimeData(anilist_id=21, title_romaji="One Piece")])
    monkeypatch.setattr("app.services.extension.get_anilist_client", lambda: fake)
    start = datetime(2026, 10, 15, tzinfo=timezone.utc)

    first = record_extension_progress(
        db,
        user,
        raw_title="Mystery Show Episode 1",
        episode=1,
        site_host="example.com",
        is_movie=False,
        now=start,
    )
    second = record_extension_progress(
        db,
        user,
        raw_title="Mystery Show Episode 1",
        episode=1,
        site_host="example.com",
        is_movie=False,
        now=start + timedelta(hours=12),
    )
    third = record_extension_progress(
        db,
        user,
        raw_title="Mystery Show Episode 1",
        episode=1,
        site_host="example.com",
        is_movie=False,
        now=start + timedelta(days=1),
    )
    assert first.matched is False
    assert second.matched is False
    assert third.matched is False
    assert fake.searches == 2
