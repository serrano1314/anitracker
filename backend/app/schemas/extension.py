from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ExtensionTokenCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Name is required")
        return cleaned


class ExtensionTokenResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    last_used_at: datetime | None
    revoked: bool
    created_at: datetime


class ExtensionTokenCreatedResponse(ExtensionTokenResponse):
    token: str


class ExtensionProgressRequest(BaseModel):
    raw_title: str = Field(min_length=1, max_length=500)
    episode: int | None = Field(default=None, ge=1, le=5000)
    site_host: str = Field(min_length=1, max_length=255)
    page_url: str = Field(min_length=1, max_length=2000)
    is_movie: bool = False

    @field_validator("raw_title", "site_host", "page_url")
    @classmethod
    def strip_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Must not be blank")
        return cleaned


class ExtensionMatchRequest(BaseModel):
    site_host: str = Field(min_length=1, max_length=255)
    raw_title: str = Field(min_length=1, max_length=500)
    anilist_id: int = Field(ge=1)

    @field_validator("site_host", "raw_title")
    @classmethod
    def strip_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Must not be blank")
        return cleaned


class ExtensionAnimeBrief(BaseModel):
    anilist_id: int
    title_romaji: str
    title_english: str | None = None
    cover_url: str | None = None
    format: str | None = None
    total_episodes: int | None = None


class ExtensionProgressMatched(BaseModel):
    matched: Literal[True] = True
    anime: ExtensionAnimeBrief
    episode: int


class ExtensionProgressUnmatched(BaseModel):
    matched: Literal[False] = False
    candidates: list[ExtensionAnimeBrief]


ExtensionProgressResponse = ExtensionProgressMatched | ExtensionProgressUnmatched


class ExtensionMatchResponse(BaseModel):
    anilist_id: int
    title_romaji: str
    title_english: str | None
    site_host: str
    raw_title: str
