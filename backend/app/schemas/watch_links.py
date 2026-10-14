from enum import StrEnum

from pydantic import BaseModel


class WatchLinkSource(StrEnum):
    saved = "saved"
    official = "official"
    search = "search"


class WatchLink(BaseModel):
    label: str
    url: str
    source: WatchLinkSource
