"""default_use_v2_worker_true

Revision ID: f0e44da24365
Revises: f1a2b3c4d5e6
Create Date: 2026-03-16 21:48:22.944335

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision: str = 'f0e44da24365'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Change server default for new projects
    op.alter_column('projects', 'use_v2_worker', server_default='true')
    # Flip all existing projects to use v2 worker
    op.execute("UPDATE projects SET use_v2_worker = true WHERE use_v2_worker = false")


def downgrade() -> None:
    op.alter_column('projects', 'use_v2_worker', server_default='false')
