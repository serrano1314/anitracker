"""In-memory per-IP rate limiting (works on a single Render instance)."""

import threading
import time
from collections import defaultdict

from fastapi import HTTPException, Request, status

from app.core.config import get_settings

_lock = threading.Lock()
_hits: dict[tuple[str, str], list[float]] = defaultdict(list)


def reset_rate_limits_for_tests() -> None:
    with _lock:
        _hits.clear()


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client is not None:
        return request.client.host
    return "unknown"


def enforce_rate_limit(request: Request, scope: str, subject: str | None = None) -> None:
    settings = get_settings()
    if scope == "auth":
        limit = settings.RATE_LIMIT_AUTH_MAX
        window = settings.RATE_LIMIT_AUTH_WINDOW_SECONDS
    elif scope == "extension":
        limit = settings.RATE_LIMIT_EXTENSION_MAX
        window = settings.RATE_LIMIT_EXTENSION_WINDOW_SECONDS
    elif scope == "contact":
        limit = settings.RATE_LIMIT_CONTACT_MAX
        window = settings.RATE_LIMIT_CONTACT_WINDOW_SECONDS
    else:
        raise ValueError(f"unknown rate limit scope: {scope}")

    key = subject if subject is not None else client_ip(request)
    now = time.monotonic()
    bucket = (scope, key)
    with _lock:
        recent = [t for t in _hits[bucket] if t > now - window]
        if len(recent) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Try again in a minute.",
            )
        recent.append(now)
        _hits[bucket] = recent
