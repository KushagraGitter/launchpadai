from __future__ import annotations

import uuid
from datetime import datetime, timezone

from pgvector.sqlalchemy import Vector
from sqlalchemy import String, Text, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

EMBEDDING_DIMENSION = 1536


class Embedding(Base):
    __tablename__ = "embeddings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    artifact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artifacts.id"), nullable=False, index=True
    )
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    phase_type: Mapped[str] = mapped_column(String(50), nullable=False)
    chunk_text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding = mapped_column(Vector(EMBEDDING_DIMENSION), nullable=False)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    artifact: Mapped["Artifact"] = relationship(back_populates="embeddings")

    __table_args__ = (
        Index(
            "ix_embeddings_vector_cosine",
            embedding,
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )
