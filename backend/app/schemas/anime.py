from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ExternalLink(BaseModel):
    site: str
    url: str


class AnimeData(BaseModel):
    anilist_id: int
    mal_id: int | None = None
    title_romaji: str
    title_english: str | None = None
    title_synonyms: list[str] = Field(default_factory=list)
    cover_url: str | None = None
    format: str | None = None
    total_episodes: int | None = None
    airing_status: str | None = None
    season_year: int | None = None
    external_links: list[ExternalLink] = Field(default_factory=list)


class AnimeResponse(AnimeData):
    model_config = ConfigDict(from_attributes=True)

    last_synced_at: datetime


class AnimeSearchResponse(BaseModel):
    page: int
    has_next_page: bool
    results: list[AnimeData]
