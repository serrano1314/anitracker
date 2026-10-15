from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.anime import router as anime_router
from app.api.auth import router as auth_router
from app.api.contact import router as contact_router
from app.api.extension import router as extension_router
from app.api.library import router as library_router
from app.api.sites import router as sites_router
from app.core.config import get_settings
from app.db.session import engine
from app.schemas.health import HealthResponse

_ = engine

settings = get_settings()

app = FastAPI(title="Anime Tracker")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(anime_router, prefix="/api/v1")
app.include_router(library_router, prefix="/api/v1")
app.include_router(sites_router, prefix="/api/v1")
app.include_router(extension_router, prefix="/api/v1")
app.include_router(contact_router, prefix="/api/v1")


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")
