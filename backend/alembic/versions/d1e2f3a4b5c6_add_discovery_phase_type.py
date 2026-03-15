"""add_discovery_phase_type

Revision ID: d1e2f3a4b5c6
Revises: c7d8e9f0a1b2
Create Date: 2026-03-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, None] = "c7d8e9f0a1b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("COMMIT")
    op.execute("ALTER TYPE phasetype ADD VALUE IF NOT EXISTS 'DISCOVERY' BEFORE 'VALIDATION'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values directly.
    # To downgrade, recreate the enum without 'discovery'.
    op.execute("""
        -- Rename old type
        ALTER TYPE phasetype RENAME TO phasetype_old;
        -- Create new type without discovery
        CREATE TYPE phasetype AS ENUM ('VALIDATION', 'PRD', 'CODING_CONTEXT', 'GTM');
        -- Update columns that use it
        ALTER TABLE phases
            ALTER COLUMN phase_type TYPE phasetype
            USING phase_type::text::phasetype;
        -- Drop old type
        DROP TYPE phasetype_old;
    """)
