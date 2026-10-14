"""create anime cache table

Revision ID: 0003_create_anime
Revises: 0002_create_users
Create Date: 2026-10-14

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_create_anime"
down_revision: Union[str, Sequence[str], None] = "0002_create_users"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "anime",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("anilist_id", sa.Integer(), nullable=False),
        sa.Column("mal_id", sa.Integer(), nullable=True),
        sa.Column("title_romaji", sa.Text(), nullable=False),
        sa.Column("title_english", sa.Text(), nullable=True),
        sa.Column(
            "title_synonyms",
            postgresql.ARRAY(sa.Text()),
            server_default=sa.text("'{}'"),
            nullable=False,
        ),
        sa.Column("cover_url", sa.Text(), nullable=True),
        sa.Column("format", sa.Text(), nullable=True),
        sa.Column("total_episodes", sa.Integer(), nullable=True),
        sa.Column("airing_status", sa.Text(), nullable=True),
        sa.Column("season_year", sa.Integer(), nullable=True),
        sa.Column(
            "external_links",
            postgresql.JSONB(),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("anilist_id", name="uq_anime_anilist_id"),
    )


def downgrade() -> None:
    op.drop_table("anime")
