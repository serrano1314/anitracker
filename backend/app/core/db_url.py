def to_sqlalchemy_url(url: str) -> str:
    """Use the psycopg3 driver without logging or altering credentials."""
    if url.startswith("postgresql+"):
        return url
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url.removeprefix("postgresql://")
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url.removeprefix("postgres://")
    return url
