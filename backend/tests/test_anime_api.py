import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.anime import Anime
from app.schemas.anime import AnimeData, AnimeSearchResponse, ExternalLink
from app.services.anilist import AniListNotFound, AniListRateLimited, AniListUnavailable

REGISTER_BODY = {
    "email": "steven@example.com",
    "username": "steven",
    "password": "password123",
}


class FakeAniList:
    def __init__(self) -> None:
        self.fetch_calls = 0
        self.data = AnimeData(
            anilist_id=21,
            mal_id=21,
            title_romaji="One Piece",
            title_english="One Piece",
            title_synonyms=["OP"],
            cover_url="https://example.com/one-piece.jpg",
            format="TV",
            total_episodes=1155,
            airing_status="RELEASING",
            season_year=1999,
            external_links=[
                ExternalLink(site="Crunchyroll", url="https://www.crunchyroll.com/one-piece")
            ],
        )

    def search(self, query: str, page: int) -> AnimeSearchResponse:
        return AnimeSearchResponse(page=page, has_next_page=False, results=[self.data])

    def fetch_media(self, anilist_id: int) -> AnimeData:
        self.fetch_calls += 1
        if anilist_id == 404:
            raise AniListNotFound("missing")
        if anilist_id == 429:
            raise AniListRateLimited("slow down")
        if anilist_id == 500:
            raise AniListUnavailable("down")
        return self.data.model_copy(update={"anilist_id": anilist_id})


def _auth(client: TestClient) -> dict[str, str]:
    response = client.post("/api/v1/auth/register", json=REGISTER_BODY)
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_search_requires_auth(client: TestClient) -> None:
    response = client.get("/api/v1/anime/search", params={"q": "One Piece"})
    assert response.status_code == 401


def test_search_returns_mapped_results_without_saving(
    client: TestClient,
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = FakeAniList()
    monkeypatch.setattr("app.services.anime.get_anilist_client", lambda: fake)
    response = client.get(
        "/api/v1/anime/search",
        params={"q": "One Piece"},
        headers=_auth(client),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["page"] == 1
    assert body["results"][0]["anilist_id"] == 21
    assert body["results"][0]["external_links"] == [
        {"site": "Crunchyroll", "url": "https://www.crunchyroll.com/one-piece"}
    ]
    assert "description" not in body["results"][0]
    assert db.scalar(select(func.count()).select_from(Anime)) == 0


def test_blank_search_is_rejected(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.anime.get_anilist_client", lambda: FakeAniList())
    response = client.get(
        "/api/v1/anime/search",
        params={"q": "   "},
        headers=_auth(client),
    )
    assert response.status_code == 422


def test_opening_anime_saves_it_and_second_open_uses_cache(
    client: TestClient,
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = FakeAniList()
    fake.data = fake.data.model_copy(update={"airing_status": "FINISHED"})
    monkeypatch.setattr("app.services.anime.get_anilist_client", lambda: fake)
    headers = _auth(client)
    first = client.get("/api/v1/anime/21", headers=headers)
    assert first.status_code == 200
    body = first.json()
    assert body["anilist_id"] == 21
    assert body["title_romaji"] == "One Piece"
    assert body["airing_status"] == "FINISHED"
    assert body["last_synced_at"]
    assert "id" not in body
    row = db.scalar(select(Anime).where(Anime.anilist_id == 21))
    assert row is not None
    assert row.title_synonyms == ["OP"]

    second = client.get("/api/v1/anime/21", headers=headers)
    assert second.status_code == 200
    assert fake.fetch_calls == 1


def test_force_cache_refetches(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    fake = FakeAniList()
    monkeypatch.setattr("app.services.anime.get_anilist_client", lambda: fake)
    headers = _auth(client)
    assert client.get("/api/v1/anime/21", headers=headers).status_code == 200
    forced = client.post("/api/v1/anime/from-anilist/21", headers=headers)
    assert forced.status_code == 200
    assert forced.json()["anilist_id"] == 21
    assert fake.fetch_calls == 2


def test_missing_anime_returns_404(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.anime.get_anilist_client", lambda: FakeAniList())
    response = client.get("/api/v1/anime/404", headers=_auth(client))
    assert response.status_code == 404


def test_rate_limit_and_outage_status_codes(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.services.anime.get_anilist_client", lambda: FakeAniList())
    headers = _auth(client)
    assert client.get("/api/v1/anime/429", headers=headers).status_code == 429
    assert client.get("/api/v1/anime/500", headers=headers).status_code == 502
