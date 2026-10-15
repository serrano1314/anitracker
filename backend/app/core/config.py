from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str
    DIRECT_URL: str
    CORS_ORIGINS: str = "http://localhost:5173"

    JWT_SECRET: str = Field(min_length=16)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    REFRESH_COOKIE_NAME: str = "refresh_token"
    COOKIE_SECURE: bool = False
    ANILIST_TIMEOUT_SECONDS: float = 10
    ANILIST_SEARCH_CACHE_TTL_SECONDS: int = 300
    ANIME_SYNC_TTL_HOURS: int = 24

    RATE_LIMIT_AUTH_MAX: int = 20
    RATE_LIMIT_AUTH_WINDOW_SECONDS: int = 60
    RATE_LIMIT_EXTENSION_MAX: int = 120
    RATE_LIMIT_EXTENSION_WINDOW_SECONDS: int = 60

    @property
    def cors_origin_list(self) -> list[str]:
        origins: list[str] = []
        for origin in self.CORS_ORIGINS.split(","):
            cleaned = origin.strip().rstrip("/")
            if cleaned:
                origins.append(cleaned)
        return origins


@lru_cache
def get_settings() -> Settings:
    return Settings()
