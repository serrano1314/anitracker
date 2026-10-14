from app.core.db_url import to_sqlalchemy_url


def test_to_sqlalchemy_url_adds_psycopg_driver() -> None:
    result = to_sqlalchemy_url("postgresql://user:pass@host/db?sslmode=require")
    assert result.startswith("postgresql+psycopg://")
    assert "user:pass@host/db" in result


def test_to_sqlalchemy_url_leaves_explicit_driver() -> None:
    url = "postgresql+psycopg://user:pass@host/db"
    assert to_sqlalchemy_url(url) == url
