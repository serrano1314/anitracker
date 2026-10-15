from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_extension_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.extension import (
    ExtensionMatchRequest,
    ExtensionMatchResponse,
    ExtensionProgressRequest,
    ExtensionProgressResponse,
    ExtensionTokenCreateRequest,
    ExtensionTokenCreatedResponse,
    ExtensionTokenResponse,
)
from app.services.anilist import AniListError, AniListNotFound, AniListRateLimited
from app.services.extension import (
    confirm_extension_match,
    create_extension_token,
    list_extension_tokens,
    record_extension_progress,
    revoke_extension_token,
)

router = APIRouter(prefix="/extension", tags=["extension"])


def _translate(exc: AniListError) -> HTTPException:
    if isinstance(exc, AniListNotFound):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Anime not found")
    if isinstance(exc, AniListRateLimited):
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="AniList rate limit reached. Try again shortly.",
        )
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="AniList is unavailable",
    )


@router.get("/tokens", response_model=list[ExtensionTokenResponse])
def read_tokens(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ExtensionTokenResponse]:
    return [ExtensionTokenResponse.model_validate(row) for row in list_extension_tokens(db, current_user)]


@router.post("/tokens", response_model=ExtensionTokenCreatedResponse, status_code=status.HTTP_201_CREATED)
def post_token(
    body: ExtensionTokenCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExtensionTokenCreatedResponse:
    row, token = create_extension_token(db, current_user, body.name)
    return ExtensionTokenCreatedResponse(
        id=row.id,
        name=row.name,
        last_used_at=row.last_used_at,
        revoked=row.revoked,
        created_at=row.created_at,
        token=token,
    )


@router.delete("/tokens/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
def destroy_token(
    token_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    revoke_extension_token(db, current_user, token_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/progress", response_model=ExtensionProgressResponse)
def post_progress(
    body: ExtensionProgressRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_extension_user),
) -> ExtensionProgressResponse:
    try:
        return record_extension_progress(
            db,
            current_user,
            raw_title=body.raw_title,
            episode=body.episode,
            site_host=body.site_host,
            is_movie=body.is_movie,
        )
    except AniListError as exc:
        raise _translate(exc) from None


@router.post("/match", response_model=ExtensionMatchResponse)
def post_match(
    body: ExtensionMatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_extension_user),
) -> ExtensionMatchResponse:
    try:
        return confirm_extension_match(
            db,
            current_user,
            site_host=body.site_host,
            raw_title=body.raw_title,
            anilist_id=body.anilist_id,
        )
    except AniListError as exc:
        raise _translate(exc) from None
