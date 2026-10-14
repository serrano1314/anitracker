import time
from collections.abc import Callable
from typing import Protocol

import httpx

from app.core.config import get_settings
from app.schemas.anime import AnimeData, AnimeSearchResponse, ExternalLink

ANILIST_URL = "https://graphql.anilist.co"
SEARCH_PER_PAGE = 20
MAX_ATTEMPTS = 3
MAX_RETRY_AFTER_SECONDS = 30.0

_MEDIA_SELECTION = """
  id
  idMal
  title {
    romaji
    english
  }
  synonyms
  coverImage {
    large
  }
  format
  episodes
  status
  seasonYear
  externalLinks {
    site
    url
    type
  }
"""

SEARCH_QUERY = f"""
query ($search: String, $page: Int, $perPage: Int) {{
  Page(page: $page, perPage: $perPage) {{
    pageInfo {{
      currentPage
      hasNextPage
    }}
    media(search: $search, type: ANIME, sort: SEARCH_MATCH) {{
      {_MEDIA_SELECTION}
    }}
  }}
}}
"""

MEDIA_QUERY = f"""
query ($id: Int) {{
  Media(id: $id, type: ANIME) {{
    {_MEDIA_SELECTION}
  }}
}}
"""

_HEADERS = {
    "Accept": "application/json",
    "Content-Type": "application/json",
}


class AniListError(Exception):
    pass


class AniListNotFound(AniListError):
    pass


class AniListRateLimited(AniListError):
    pass


class AniListUnavailable(AniListError):
    pass


class HttpPoster(Protocol):
    def post(
        self,
        url: str,
        *,
        json: dict[str, object],
        headers: dict[str, str],
    ) -> httpx.Response: ...


class TtlCache:
    def __init__(self, ttl_seconds: float, clock: Callable[[], float] = time.monotonic) -> None:
        self._ttl_seconds = ttl_seconds
        self._clock = clock
        self._items: dict[tuple[str, int], tuple[float, AnimeSearchResponse]] = {}

    def get(self, key: tuple[str, int]) -> AnimeSearchResponse | None:
        item = self._items.get(key)
        if item is None:
            return None
        expires_at, value = item
        if self._clock() >= expires_at:
            del self._items[key]
            return None
        return value

    def set(self, key: tuple[str, int], value: AnimeSearchResponse) -> None:
        self._items[key] = (self._clock() + self._ttl_seconds, value)


def normalize_search_query(query: str) -> str:
    return " ".join(query.split()).casefold()


def _as_int(value: object) -> int | None:
    if isinstance(value, bool) or not isinstance(value, int):
        return None
    return value


def _as_str(value: object) -> str | None:
    if isinstance(value, str) and value.strip():
        return value
    return None


def map_media(media: object) -> AnimeData | None:
    if not isinstance(media, dict):
        return None
    anilist_id = _as_int(media.get("id"))
    if anilist_id is None:
        return None

    title = media.get("title")
    romaji: str | None = None
    english: str | None = None
    if isinstance(title, dict):
        romaji = _as_str(title.get("romaji"))
        english = _as_str(title.get("english"))

    synonyms: list[str] = []
    raw_synonyms = media.get("synonyms")
    if isinstance(raw_synonyms, list):
        synonyms = [item for item in raw_synonyms if isinstance(item, str) and item.strip()]

    cover_url: str | None = None
    cover = media.get("coverImage")
    if isinstance(cover, dict):
        cover_url = _as_str(cover.get("large"))

    links: list[ExternalLink] = []
    raw_links = media.get("externalLinks")
    if isinstance(raw_links, list):
        for item in raw_links:
            if not isinstance(item, dict) or item.get("type") != "STREAMING":
                continue
            site = _as_str(item.get("site"))
            url = _as_str(item.get("url"))
            if site and url:
                links.append(ExternalLink(site=site, url=url))

    return AnimeData(
        anilist_id=anilist_id,
        mal_id=_as_int(media.get("idMal")),
        title_romaji=romaji or english or "Unknown",
        title_english=english,
        title_synonyms=synonyms,
        cover_url=cover_url,
        format=_as_str(media.get("format")),
        total_episodes=_as_int(media.get("episodes")),
        airing_status=_as_str(media.get("status")),
        season_year=_as_int(media.get("seasonYear")),
        external_links=links,
    )


def _retry_delay(response: httpx.Response, attempt: int) -> float:
    header = response.headers.get("Retry-After", "").strip()
    if header:
        try:
            seconds = float(header)
        except ValueError:
            seconds = -1
        if seconds >= 0:
            return min(seconds, MAX_RETRY_AFTER_SECONDS)
    return min(float(2 ** (attempt - 1)), MAX_RETRY_AFTER_SECONDS)


def _raise_for_graphql(payload: dict[str, object]) -> None:
    errors = payload.get("errors")
    if not isinstance(errors, list) or not errors:
        return
    for error in errors:
        if isinstance(error, dict) and error.get("status") == 404:
            raise AniListNotFound("Anime not found")
    raise AniListError("AniList request failed")


class AniListClient:
    def __init__(
        self,
        http_client: HttpPoster | None = None,
        *,
        search_ttl_seconds: float = 300,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._http = http_client or httpx.Client(timeout=get_settings().ANILIST_TIMEOUT_SECONDS)
        self._sleep = sleep
        self._cache = TtlCache(search_ttl_seconds, clock)

    def search(self, query: str, page: int) -> AnimeSearchResponse:
        normalized = normalize_search_query(query)
        if not normalized:
            raise AniListError("Search query is required")
        key = (normalized, page)
        cached = self._cache.get(key)
        if cached is not None:
            return cached

        payload = self._post(
            SEARCH_QUERY,
            {"search": normalized, "page": page, "perPage": SEARCH_PER_PAGE},
        )
        data = payload.get("data")
        page_data = data.get("Page") if isinstance(data, dict) else None
        if not isinstance(page_data, dict):
            raise AniListUnavailable("AniList returned an unexpected search payload")

        info = page_data.get("pageInfo")
        current_page = page
        has_next_page = False
        if isinstance(info, dict):
            parsed_page = _as_int(info.get("currentPage"))
            if parsed_page is not None:
                current_page = parsed_page
            has_next_page = bool(info.get("hasNextPage"))

        results: list[AnimeData] = []
        media = page_data.get("media")
        if isinstance(media, list):
            for item in media:
                mapped = map_media(item)
                if mapped is not None:
                    results.append(mapped)

        result = AnimeSearchResponse(
            page=current_page,
            has_next_page=has_next_page,
            results=results,
        )
        self._cache.set(key, result)
        return result

    def fetch_media(self, anilist_id: int) -> AnimeData:
        payload = self._post(MEDIA_QUERY, {"id": anilist_id})
        data = payload.get("data")
        media = data.get("Media") if isinstance(data, dict) else None
        if media is None:
            raise AniListNotFound("Anime not found")
        mapped = map_media(media)
        if mapped is None:
            raise AniListUnavailable("AniList returned an unexpected anime payload")
        return mapped

    def _post(self, query: str, variables: dict[str, object]) -> dict[str, object]:
        body: dict[str, object] = {"query": query, "variables": variables}
        attempt = 0
        while True:
            attempt += 1
            try:
                response = self._http.post(ANILIST_URL, json=body, headers=_HEADERS)
            except httpx.TimeoutException as exc:
                raise AniListUnavailable("AniList timed out") from exc
            except httpx.HTTPError as exc:
                raise AniListUnavailable("AniList request failed") from exc

            if response.status_code == 429:
                if attempt >= MAX_ATTEMPTS:
                    raise AniListRateLimited("AniList rate limit")
                self._sleep(_retry_delay(response, attempt))
                continue
            if response.status_code >= 500:
                raise AniListUnavailable("AniList is unavailable")
            if response.status_code != 200:
                raise AniListError("AniList request failed")
            payload = _read_json(response)
            _raise_for_graphql(payload)
            return payload


def _read_json(response: httpx.Response) -> dict[str, object]:
    try:
        payload = response.json()
    except ValueError as exc:
        raise AniListUnavailable("AniList returned invalid JSON") from exc
    if not isinstance(payload, dict):
        raise AniListUnavailable("AniList returned invalid JSON")
    return payload


_client: AniListClient | None = None


def get_anilist_client() -> AniListClient:
    global _client
    if _client is None:
        settings = get_settings()
        _client = AniListClient(
            httpx.Client(timeout=settings.ANILIST_TIMEOUT_SECONDS),
            search_ttl_seconds=settings.ANILIST_SEARCH_CACHE_TTL_SECONDS,
        )
    return _client
