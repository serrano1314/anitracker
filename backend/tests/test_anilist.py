import httpx

from app.services.anilist import (
    AniListClient,
    AniListNotFound,
    AniListRateLimited,
    AniListUnavailable,
    episode_count,
    map_media,
)


class FakeHttp:
    def __init__(self, responses: list[httpx.Response | Exception]) -> None:
        self._responses = list(responses)
        self.calls: list[dict[str, object]] = []

    def post(
        self,
        url: str,
        *,
        json: dict[str, object],
        headers: dict[str, str],
    ) -> httpx.Response:
        self.calls.append({"url": url, "json": json, "headers": headers})
        item = self._responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


def _media() -> dict[str, object]:
    return {
        "id": 21,
        "idMal": 21,
        "title": {"romaji": "One Piece", "english": "One Piece"},
        "synonyms": ["OP", "", 12],
        "coverImage": {"large": "https://example.com/one-piece.jpg"},
        "format": "TV",
        "episodes": None,
        "status": "RELEASING",
        "seasonYear": 1999,
        "externalLinks": [
            {
                "site": "Crunchyroll",
                "url": "https://www.crunchyroll.com/one-piece",
                "type": "STREAMING",
            },
            {"site": "Twitter", "url": "https://twitter.com/onepiece", "type": "SOCIAL"},
            {"site": "Official Site", "url": "https://one-piece.com", "type": "INFO"},
            {"site": "", "url": "https://example.com", "type": "STREAMING"},
        ],
        "description": "raw graphql field that must not leak",
    }


def test_map_media_keeps_our_fields_and_streaming_links_only() -> None:
    mapped = map_media(_media())
    assert mapped is not None
    dumped = mapped.model_dump()
    assert set(dumped) == {
        "anilist_id",
        "mal_id",
        "title_romaji",
        "title_english",
        "title_synonyms",
        "cover_url",
        "format",
        "total_episodes",
        "airing_status",
        "season_year",
        "external_links",
    }
    assert dumped["anilist_id"] == 21
    assert dumped["title_synonyms"] == ["OP"]
    assert dumped["total_episodes"] is None
    assert dumped["airing_status"] == "RELEASING"
    assert dumped["external_links"] == [
        {"site": "Crunchyroll", "url": "https://www.crunchyroll.com/one-piece"}
    ]


def test_releasing_show_uses_episodes_aired_when_the_total_is_unknown() -> None:
    media = _media()
    media["nextAiringEpisode"] = {"episode": 1181}
    assert episode_count(media, "RELEASING") == 1180
    mapped = map_media(media)
    assert mapped is not None
    assert mapped.total_episodes == 1180


def test_known_total_wins_over_the_next_airing_episode() -> None:
    media = _media()
    media["episodes"] = 12
    media["nextAiringEpisode"] = {"episode": 5}
    assert episode_count(media, "RELEASING") == 12


def test_next_episode_one_stays_unknown() -> None:
    media = _media()
    media["nextAiringEpisode"] = {"episode": 1}
    assert episode_count(media, "RELEASING") is None
    media["nextAiringEpisode"] = {"episode": True}
    assert episode_count(media, "RELEASING") is None


def test_finished_show_does_not_guess_a_total_from_the_schedule() -> None:
    media = _media()
    media["status"] = "FINISHED"
    media["nextAiringEpisode"] = {"episode": 1181}
    assert episode_count(media, "FINISHED") is None


def test_map_media_uses_english_when_romaji_is_missing() -> None:
    media = _media()
    media["title"] = {"romaji": None, "english": "Attack on Titan"}
    mapped = map_media(media)
    assert mapped is not None
    assert mapped.title_romaji == "Attack on Titan"
    assert mapped.title_english == "Attack on Titan"


def test_search_uses_memory_cache_and_normalizes_the_query() -> None:
    http = FakeHttp(
        [
            httpx.Response(
                200,
                json={
                    "data": {
                        "Page": {
                            "pageInfo": {"currentPage": 1, "hasNextPage": True},
                            "media": [_media()],
                        }
                    }
                },
            )
        ]
    )
    client = AniListClient(http, search_ttl_seconds=60)
    first = client.search("  One   Piece ", 1)
    second = client.search("one piece", 1)
    assert first == second
    assert len(http.calls) == 1
    sent = http.calls[0]["json"]
    assert isinstance(sent, dict)
    variables = sent["variables"]
    assert isinstance(variables, dict)
    assert variables["search"] == "one piece"
    assert first.results[0].title_romaji == "One Piece"
    assert first.has_next_page is True


def test_search_cache_expires() -> None:
    now = {"t": 0.0}
    http = FakeHttp(
        [
            httpx.Response(
                200,
                json={"data": {"Page": {"pageInfo": {}, "media": [_media()]}}},
            ),
            httpx.Response(
                200,
                json={"data": {"Page": {"pageInfo": {}, "media": []}}},
            ),
        ]
    )
    client = AniListClient(http, search_ttl_seconds=10, clock=lambda: now["t"])
    assert len(client.search("one piece", 1).results) == 1
    now["t"] = 10
    assert client.search("one piece", 1).results == []
    assert len(http.calls) == 2


def test_rate_limit_backoff_then_success() -> None:
    delays: list[float] = []
    http = FakeHttp(
        [
            httpx.Response(429, headers={"Retry-After": "2"}),
            httpx.Response(200, json={"data": {"Media": _media()}}),
        ]
    )
    client = AniListClient(http, sleep=delays.append)
    media = client.fetch_media(21)
    assert media.anilist_id == 21
    assert delays == [2.0]
    assert len(http.calls) == 2


def test_rate_limit_gives_up_after_three_attempts() -> None:
    delays: list[float] = []
    http = FakeHttp([httpx.Response(429), httpx.Response(429), httpx.Response(429)])
    client = AniListClient(http, sleep=delays.append)
    try:
        client.fetch_media(21)
    except AniListRateLimited:
        pass
    else:
        raise AssertionError("expected rate limit")
    assert delays == [1.0, 2.0]
    assert len(http.calls) == 3


def test_fetch_not_found_from_graphql_error() -> None:
    http = FakeHttp(
        [httpx.Response(200, json={"errors": [{"message": "Not Found.", "status": 404}], "data": {"Media": None}})]
    )
    client = AniListClient(http)
    try:
        client.fetch_media(999999)
    except AniListNotFound:
        pass
    else:
        raise AssertionError("expected not found")


def test_timeout_is_unavailable() -> None:
    http = FakeHttp([httpx.TimeoutException("timed out")])
    client = AniListClient(http)
    try:
        client.fetch_media(21)
    except AniListUnavailable:
        pass
    else:
        raise AssertionError("expected unavailable")

