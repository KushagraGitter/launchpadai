from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phase_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("phases.id"), nullable=False, index=True
    )
    crew_name: Mapped[str] = mapped_column(String(255), nullable=False)
    agent_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    token_usage: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    output_summary: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    logs: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    phase: Mapped["Phase"] = relationship(back_populates="agent_runs")
