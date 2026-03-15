"""add_phase_feedback_table

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-03-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "e2f3a4b5c6d7"
down_revision: Union[str, None] = "d1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    feedbacktype = postgresql.ENUM(
        "THUMBS_UP", "THUMBS_DOWN", "COMMENT",
        name="feedbacktype",
        create_type=False,
    )
    feedbacktype.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "phase_feedback",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("phase_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("phases.id"), nullable=False),
        sa.Column("artifact_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("artifacts.id"), nullable=True),
        sa.Column("section", sa.String(500), nullable=False),
        sa.Column("feedback_type", feedbacktype, nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_phase_feedback_phase_id", "phase_feedback", ["phase_id"])


def downgrade() -> None:
    op.drop_index("ix_phase_feedback_phase_id", table_name="phase_feedback")
    op.drop_table("phase_feedback")
    op.execute("DROP TYPE IF EXISTS feedbacktype")
