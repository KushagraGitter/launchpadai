"""GitHub integration model — stores a user's GitHub PAT (or future OAuth token)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class GitHubIntegration(Base):
    __tablename__ = "github_integrations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    github_username: Mapped[str] = mapped_column(String(255), nullable=False)
    github_token: Mapped[str] = mapped_column(Text, nullable=False)  # PAT or OAuth token
    default_repo: Mapped[str | None] = mapped_column(String(500), nullable=True)  # "owner/repo"
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    connected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    owner: Mapped["User"] = relationship(back_populates="github_integration")
