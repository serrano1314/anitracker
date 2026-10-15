import hashlib
import logging
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password, verify_password
from app.models.password_reset import PasswordResetToken
from app.models.user import User
from app.services.auth import get_user_by_email

logger = logging.getLogger(__name__)


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def change_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    if not verify_password(current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    if verify_password(new_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password",
        )
    user.password_hash = hash_password(new_password)
    db.add(user)
    db.commit()


def request_password_reset(db: Session, email: str) -> None:
    user = get_user_by_email(db, email)
    if user is None:
        return

    settings = get_settings()
    now = datetime.now(UTC)
    expires_at = now + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES)

    db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        )
        .values(used_at=now)
    )

    raw_token = secrets.token_urlsafe(32)
    row = PasswordResetToken(
        user_id=user.id,
        token_hash=hash_reset_token(raw_token),
        expires_at=expires_at,
    )
    db.add(row)
    db.commit()

    reset_url = f"{settings.frontend_url.rstrip('/')}/reset-password?token={raw_token}"
    logger.info("Password reset requested for %s (link valid %s min): %s", user.email, settings.PASSWORD_RESET_EXPIRE_MINUTES, reset_url)


def reset_password_with_token(db: Session, token: str, new_password: str) -> None:
    cleaned = token.strip()
    if not cleaned:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset link")

    token_hash = hash_reset_token(cleaned)
    now = datetime.now(UTC)
    row = db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > now,
        )
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset link")

    user = db.get(User, row.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset link")

    user.password_hash = hash_password(new_password)
    row.used_at = now
    db.add(user)
    db.add(row)
    db.commit()


def create_password_reset_token_for_tests(db: Session, user_id: UUID) -> str:
    """Issue a reset token and return the raw secret (tests only)."""
    settings = get_settings()
    now = datetime.now(UTC)
    raw_token = secrets.token_urlsafe(32)
    row = PasswordResetToken(
        user_id=user_id,
        token_hash=hash_reset_token(raw_token),
        expires_at=now + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES),
    )
    db.add(row)
    db.commit()
    return raw_token
