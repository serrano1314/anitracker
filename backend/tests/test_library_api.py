from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.anime import Anime
from app.models.library import EpisodeProgress

REGISTER_BODY = {
    "email": "steven@example.com",
    "username": "steven",
    "password": "password123",
}


def _auth(client: TestClient, body: dict[str, str] | None = None) -> dict[str, str]:
    response = client.post("/api/v1/auth/register", json=body or REGISTER_BODY)
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _cache(db: Session, anilist_id: int = 21, total: int | None = 24) -> Anime:
    anime = Anime(
        anilist_id=anilist_id,
        title_romaji="One Piece",
        title_english="One Piece",
        title_synonyms=["OP"],
        cover_url="https://example.com/one-piece.jpg",
        format="TV",
        total_episodes=total,
        external_links=[],
        last_synced_at=datetime.now(timezone.utc),
    )
    db.add(anime)
    db.commit()
    return anime


def test_library_requires_auth(client: TestClient) -> None:
    assert client.get("/api/v1/library").status_code == 401
    assert client.post("/api/v1/library", json={"anilist_id": 21, "status": "watching"}).status_code == 401


def test_library_crud_and_progress(client: TestClient, db: Session) -> None:
    _cache(db)
    headers = _auth(client)

    created = client.post(
        "/api/v1/library",
        json={"anilist_id": 21, "status": "watching"},
        headers=headers,
    )
    assert created.status_code == 201
    body = created.json()
    assert body["anilist_id"] == 21
    assert body["status"] == "watching"
    assert body["watched_count"] == 0
    assert body["last_episode_watched"] == 0
    assert body["total_episodes"] == 24
    assert body["title_romaji"] == "One Piece"
    assert "id" not in body

    duplicate = client.post(
        "/api/v1/library",
        json={"anilist_id": 21, "status": "dropped"},
        headers=headers,
    )
    assert duplicate.status_code == 409

    patched = client.patch(
        "/api/v1/library/21",
        json={"score": 8, "status": "on_hold"},
        headers=headers,
    )
    assert patched.status_code == 200
    assert patched.json()["score"] == 8
    assert patched.json()["status"] == "on_hold"

    cleared = client.patch("/api/v1/library/21", json={"score": None}, headers=headers)
    assert cleared.status_code == 200
    assert cleared.json()["score"] is None
    assert cleared.json()["status"] == "on_hold"

    marked = client.put(
        "/api/v1/library/21/episodes/13",
        json={"watched": True, "source_site": "netflix"},
        headers=headers,
    )
    assert marked.status_code == 200
    assert marked.json()["last_episode_watched"] == 13
    assert marked.json()["watched_count"] == 1
    assert marked.json()["status"] == "on_hold"

    up_to = client.post("/api/v1/library/21/episodes/mark-up-to/10", headers=headers)
    assert up_to.status_code == 200
    assert up_to.json()["watched_count"] == 11
    assert up_to.json()["last_episode_watched"] == 13

    episodes = client.get("/api/v1/library/21/episodes", headers=headers)
    assert episodes.status_code == 200
    assert episodes.json()["episodes"] == list(range(1, 11)) + [13]

    listed = client.get("/api/v1/library", params={"status": "on_hold"}, headers=headers)
    assert listed.status_code == 200
    assert listed.json()["results"][0]["watched_count"] == 11
    empty = client.get("/api/v1/library", params={"status": "dropped"}, headers=headers)
    assert empty.json()["results"] == []

    removed = client.delete("/api/v1/library/21", headers=headers)
    assert removed.status_code == 204
    assert client.get("/api/v1/library/21/episodes", headers=headers).status_code == 404
    assert db.scalar(select(func.count()).select_from(EpisodeProgress)) == 0


def test_library_is_private_per_user(client: TestClient, db: Session) -> None:
    _cache(db)
    owner = _auth(client)
    client.post("/api/v1/library", json={"anilist_id": 21, "status": "watching"}, headers=owner)
    other = _auth(
        client,
        {"email": "other@example.com", "username": "other", "password": "password123"},
    )
    assert client.get("/api/v1/library", headers=other).json()["results"] == []
    assert client.patch("/api/v1/library/21", json={"score": 5}, headers=other).status_code == 404


def test_invalid_score_is_rejected(client: TestClient, db: Session) -> None:
    _cache(db)
    headers = _auth(client)
    client.post("/api/v1/library", json={"anilist_id": 21, "status": "watching"}, headers=headers)
    response = client.patch("/api/v1/library/21", json={"score": 11}, headers=headers)
    assert response.status_code == 422


def test_library_page_reports_next_page(client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.library.LIBRARY_PAGE_SIZE", 1)
    headers = _auth(client)
    _cache(db, anilist_id=1, total=12)
    _cache(db, anilist_id=2, total=12)
    client.post("/api/v1/library", json={"anilist_id": 1, "status": "watching"}, headers=headers)
    client.post("/api/v1/library", json={"anilist_id": 2, "status": "watching"}, headers=headers)

    first = client.get("/api/v1/library", params={"page": 1}, headers=headers)
    assert first.status_code == 200
    assert first.json()["has_next_page"] is True
    assert len(first.json()["results"]) == 1
    second = client.get("/api/v1/library", params={"page": 2}, headers=headers)
    assert second.json()["has_next_page"] is False
    assert len(second.json()["results"]) == 1
