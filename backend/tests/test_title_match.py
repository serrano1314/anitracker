from datetime import datetime, timedelta, timezone

from rapidfuzz import fuzz

from app.schemas.anime import AnimeData
from app.services.title_match import (
    MATCH_THRESHOLD,
    LibraryTitle,
    TitleSearchCache,
    best_library_match,
    clean_title,
    normalize_host,
)


def test_clean_title_strips_watch_metadata_and_site_name() -> None:
    cleaned = clean_title("Watch One Piece Episode 812 English Sub - 9anime", "9anime.to")
    assert cleaned == "one piece"


def test_clean_title_strips_brackets_dub_and_short_episode_marks() -> None:
    assert clean_title("Shingeki no Kyojin Episode 1 [English Dub]") == "shingeki no kyojin"
    assert clean_title("One Piece e12 (Subbed)") == "one piece"
    assert clean_title("Attack on Titan - 05") == "attack on titan"
    assert clean_title("  Watch   Naruto   ") == "naruto"


def test_clean_title_keeps_season_words() -> None:
    assert clean_title("Attack on Titan Season 2") == "attack on titan season 2"


def test_normalize_host() -> None:
    assert normalize_host("https://www.Example.com:443/watch/1") == "example.com"
    assert normalize_host("EXAMPLE.com") == "example.com"


def test_library_match_accepts_a_clear_score_and_rejects_neighbors() -> None:
    assert fuzz.ratio("one piece", "one piece film red") < MATCH_THRESHOLD
    assert fuzz.ratio("attack on titan", "attack on titan season 2") < MATCH_THRESHOLD

    rows = [
        LibraryTitle(21, ("one piece",)),
        LibraryTitle(22, ("one piece film red",)),
        LibraryTitle(16498, ("shingeki no kyojin", "attack on titan")),
    ]
    assert best_library_match("one piece", rows) == 21
    assert best_library_match("attack on titan", rows) == 16498
    assert best_library_match("completely different", rows) is None
    assert best_library_match("", rows) is None


def test_library_match_refuses_two_equally_good_titles() -> None:
    rows = [
        LibraryTitle(1, ("alpha show",)),
        LibraryTitle(2, ("alpha show",)),
    ]
    assert best_library_match("alpha show", rows) is None


def test_title_search_cache_keeps_one_result_per_day() -> None:
    cache = TitleSearchCache()
    now = datetime(2026, 10, 15, tzinfo=timezone.utc)
    key = ("user", "example.com", "One Piece Episode 1")
    payload = [AnimeData(anilist_id=21, title_romaji="One Piece")]

    assert cache.get(key, now) is None
    cache.set(key, payload, now)
    assert cache.get(key, now + timedelta(hours=23)) == payload
    assert cache.get(key, now + timedelta(days=1)) is None
