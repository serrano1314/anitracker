from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_refresh_token_subject
from app.core.security import (
    clear_refresh_cookie,
    create_access_token,
    create_refresh_token,
    set_refresh_cookie,
)
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.schemas.user import UserResponse
from app.services.auth import authenticate_user, get_user_by_id, register_user

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue_tokens(response: Response, user: User) -> TokenResponse:
    set_refresh_cookie(response, create_refresh_token(user.id))
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(
    body: RegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> TokenResponse:
    user = register_user(db, body.email, body.username, body.password)
    return _issue_tokens(response, user)


@router.post("/login", response_model=TokenResponse)
def login(
    body: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> TokenResponse:
    user = authenticate_user(db, body.email, body.password)
    return _issue_tokens(response, user)


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    response: Response,
    user_id: UUID = Depends(get_refresh_token_subject),
    db: Session = Depends(get_db),
) -> TokenResponse:
    user = get_user_by_id(db, user_id)
    if user is None:
        clear_refresh_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return _issue_tokens(response, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    _current_user: User = Depends(get_current_user),
) -> None:
    clear_refresh_cookie(response)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
