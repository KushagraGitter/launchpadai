from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Artifact(Base):
    __tablename__ = "artifacts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phase_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("phases.id"), nullable=False, index=True
    )
    agent_name: Mapped[str] = mapped_column(String(255), nullable=False)
    artifact_type: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    markdown_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    phase: Mapped["Phase"] = relationship(back_populates="artifacts")
    embeddings: Mapped[list["Embedding"]] = relationship(back_populates="artifact", cascade="all, delete-orphan")
