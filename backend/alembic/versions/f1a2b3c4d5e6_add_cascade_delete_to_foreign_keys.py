"""add_cascade_delete_to_foreign_keys

Revision ID: f1a2b3c4d5e6
Revises: e2f3a4b5c6d7
Create Date: 2026-03-02 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "e2f3a4b5c6d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FK_UPDATES = [
    ("phases", "phases_project_id_fkey", "project_id", "projects.id"),
    ("artifacts", "artifacts_phase_id_fkey", "phase_id", "phases.id"),
    ("agent_runs", "agent_runs_phase_id_fkey", "phase_id", "phases.id"),
    ("embeddings", "embeddings_artifact_id_fkey", "artifact_id", "artifacts.id"),
    ("phase_feedback", "phase_feedback_phase_id_fkey", "phase_id", "phases.id"),
    ("phase_feedback", "phase_feedback_artifact_id_fkey", "artifact_id", "artifacts.id"),
]


def upgrade() -> None:
    for table, constraint, column, referent in FK_UPDATES:
        op.drop_constraint(constraint, table, type_="foreignkey")
        op.create_foreign_key(constraint, table, referent.split(".")[0], [column], [referent.split(".")[1]], ondelete="CASCADE")


def downgrade() -> None:
    for table, constraint, column, referent in FK_UPDATES:
        op.drop_constraint(constraint, table, type_="foreignkey")
        op.create_foreign_key(constraint, table, referent.split(".")[0], [column], [referent.split(".")[1]])
