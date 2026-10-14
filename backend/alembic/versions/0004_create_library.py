"""create library and episode progress tables

Revision ID: 0004_create_library
Revises: 0003_create_anime
Create Date: 2026-10-14

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_create_library"
down_revision: Union[str, Sequence[str], None] = "0003_create_anime"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_anime",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("anime_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.Column("last_episode_watched", sa.Integer(), server_default="0", nullable=False),
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
        sa.CheckConstraint(
            "status IN ('watching', 'completed', 'plan_to_watch', 'on_hold', 'dropped')",
            name="ck_user_anime_status",
        ),
        sa.CheckConstraint(
            "score IS NULL OR (score >= 1 AND score <= 10)",
            name="ck_user_anime_score",
        ),
        sa.CheckConstraint("last_episode_watched >= 0", name="ck_user_anime_last_episode"),
        sa.ForeignKeyConstraint(["anime_id"], ["anime.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "anime_id", name="uq_user_anime_user_id_anime_id"),
    )
    op.create_index("ix_user_anime_user_id_status", "user_anime", ["user_id", "status"])

    op.create_table(
        "episode_progress",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("anime_id", sa.Uuid(), nullable=False),
        sa.Column("episode_number", sa.Integer(), nullable=False),
        sa.Column("watched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source_site", sa.Text(), nullable=True),
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
        sa.CheckConstraint("episode_number >= 1", name="ck_episode_progress_episode_number"),
        sa.ForeignKeyConstraint(["anime_id"], ["anime.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "anime_id",
            "episode_number",
            name="uq_episode_progress_user_anime_episode",
        ),
    )
    op.create_index(
        "ix_episode_progress_user_id_anime_id",
        "episode_progress",
        ["user_id", "anime_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_episode_progress_user_id_anime_id", table_name="episode_progress")
    op.drop_table("episode_progress")
    op.drop_index("ix_user_anime_user_id_status", table_name="user_anime")
    op.drop_table("user_anime")
