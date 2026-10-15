import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from urllib.parse import urlparse

from rapidfuzz import fuzz

from app.schemas.anime import AnimeData

MATCH_THRESHOLD = 90
TITLE_SEARCH_TTL = timedelta(days=1)
CANDIDATE_LIMIT = 5

_BRACKETS = re.compile(r"[\(\[\{][^\)\]\}]*[\)\]\}]")
_EPISODE = re.compile(r"\b(?:episode|ep\.?)\s*\d+\b", re.IGNORECASE)
_EPISODE_SHORT = re.compile(r"\be\d+\b", re.IGNORECASE)
_TRAILING_EPISODE = re.compile(r"\s+-\s*\d+\s*$")
_SUB_DUB = re.compile(r"\b(?:english\s+)?(?:sub|dub)(?:bed|s)?\b", re.IGNORECASE)
_WATCH = re.compile(r"\bwatch\b", re.IGNORECASE)
_NON_ALNUM = re.compile(r"[^a-z0-9]+")
_SKIP_HOST_LABELS = {"www", "watch", "anime", "video", "stream", "streaming"}


@dataclass(frozen=True)
class LibraryTitle:
    anilist_id: int
    titles: tuple[str, ...]


class TitleSearchCache:
    """One AniList search per user, site, and raw title per day."""

    def __init__(self, ttl: timedelta = TITLE_SEARCH_TTL) -> None:
        self._ttl = ttl
        self._items: dict[tuple[str, str, str], tuple[datetime, list[AnimeData]]] = {}

    def get(self, key: tuple[str, str, str], now: datetime) -> list[AnimeData] | None:
        item = self._items.get(key)
        if item is None:
            return None
        stored_at, value = item
        if now - stored_at >= self._ttl:
            del self._items[key]
            return None
        return value

    def set(self, key: tuple[str, str, str], value: list[AnimeData], now: datetime) -> None:
        self._items[key] = (now, value)

    def clear(self) -> None:
        self._items.clear()


_search_cache = TitleSearchCache()


def get_title_search_cache() -> TitleSearchCache:
    return _search_cache


def normalize_host(site_host: str) -> str:
    value = site_host.strip().casefold()
    if "://" in value:
        host = urlparse(value).hostname or ""
    else:
        host = value.split("/")[0]
    if host.startswith("www."):
        host = host[4:]
    host = host.split(":")[0]
    if not host or any(char.isspace() for char in host):
        raise ValueError("Site host is required")
    return host


def clean_title(raw_title: str, site_host: str | None = None) -> str:
    text = raw_title.casefold()
    text = _BRACKETS.sub(" ", text)
    text = _EPISODE.sub(" ", text)
    text = _EPISODE_SHORT.sub(" ", text)
    text = _TRAILING_EPISODE.sub(" ", text)
    text = _SUB_DUB.sub(" ", text)
    text = _WATCH.sub(" ", text)
    label = _host_label(site_host)
    if label:
        text = re.sub(rf"\b{re.escape(label)}\b", " ", text)
    text = _NON_ALNUM.sub(" ", text)
    return " ".join(text.split())


def best_library_match(cleaned: str, rows: list[LibraryTitle]) -> int | None:
    """Return an AniList id only when one library title scores 90 or higher."""
    if not cleaned:
        return None
    scored: list[tuple[float, int]] = []
    for row in rows:
        best = 0.0
        for title in row.titles:
            if not title:
                continue
            best = max(best, float(fuzz.ratio(cleaned, title)))
        if best >= MATCH_THRESHOLD:
            scored.append((best, row.anilist_id))
    if not scored:
        return None
    scored.sort(key=lambda item: item[0], reverse=True)
    top_id = scored[0][1]
    for _score, anilist_id in scored[1:]:
        if anilist_id != top_id:
            return None
    return top_id


def _host_label(site_host: str | None) -> str | None:
    if not site_host:
        return None
    try:
        host = normalize_host(site_host)
    except ValueError:
        return None
    label = host.split(".")[0]
    if len(label) < 4 or label in _SKIP_HOST_LABELS:
        return None
    return label
