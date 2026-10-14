from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
from app.core.db_url import to_sqlalchemy_url

settings = get_settings()

engine = create_engine(
    to_sqlalchemy_url(settings.DATABASE_URL),
    poolclass=NullPool,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
