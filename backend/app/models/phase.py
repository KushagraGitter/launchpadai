from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PhaseType(str, enum.Enum):
    DISCOVERY = "discovery"
    VALIDATION = "validation"
    PRD = "prd"
    CODING_CONTEXT = "coding_context"
    GTM = "gtm"


class Phase(Base):
    __tablename__ = "phases"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    phase_type: Mapped[PhaseType] = mapped_column(Enum(PhaseType), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    project: Mapped["Project"] = relationship(back_populates="phases")
    artifacts: Mapped[list["Artifact"]] = relationship(back_populates="phase", cascade="all, delete-orphan")
    agent_runs: Mapped[list["AgentRun"]] = relationship(back_populates="phase", cascade="all, delete-orphan")
    feedback: Mapped[list["PhaseFeedback"]] = relationship(back_populates="phase", cascade="all, delete-orphan")
