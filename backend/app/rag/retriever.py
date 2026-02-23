"""pgvector-based semantic retrieval for cross-phase context continuity."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.embedding import Embedding
from app.rag.embeddings import generate_embedding


async def store_embeddings(
    db: AsyncSession,
    artifact_id: uuid.UUID,
    project_id: uuid.UUID,
    phase_type: str,
    chunks: list[dict[str, Any]],
    vectors: list[list[float]],
) -> list[Embedding]:
    """Store chunk embeddings in pgvector."""
    embeddings = []
    for chunk, vector in zip(chunks, vectors):
        emb = Embedding(
            artifact_id=artifact_id,
            project_id=project_id,
            phase_type=phase_type,
            chunk_text=chunk["text"],
            embedding=vector,
            metadata_=chunk.get("metadata"),
        )
        db.add(emb)
        embeddings.append(emb)
    await db.flush()
    return embeddings


async def retrieve_context(
    db: AsyncSession,
    project_id: uuid.UUID,
    query: str,
    top_k: int = 10,
    phase_filter: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Retrieve the most relevant chunks from prior phases using cosine similarity."""
    query_vector = generate_embedding(query)

    vector_literal = "[" + ",".join(str(v) for v in query_vector) + "]"

    phase_clause = "AND phase_type = ANY(:phases)" if phase_filter else ""

    sql = text(
        "SELECT id, chunk_text, phase_type, metadata, "
        f"1 - (embedding <=> '{vector_literal}'\\:\\:vector) AS similarity "
        "FROM embeddings "
        "WHERE project_id = :project_id "
        f"{phase_clause} "
        f"ORDER BY embedding <=> '{vector_literal}'\\:\\:vector "
        "LIMIT :top_k"
    )

    params: dict[str, Any] = {
        "project_id": project_id,
        "top_k": top_k,
    }
    if phase_filter:
        params["phases"] = phase_filter

    result = await db.execute(sql, params)
    rows = result.fetchall()

    return [
        {
            "id": str(row.id),
            "text": row.chunk_text,
            "phase": row.phase_type,
            "metadata": row.metadata,
            "similarity": float(row.similarity),
        }
        for row in rows
    ]


async def get_phase_context(
    db: AsyncSession,
    project_id: uuid.UUID,
    query: str,
    prior_phases: list[str],
    top_k: int = 15,
) -> str:
    """Retrieve and format prior phase context as a string for agent prompts."""
    if not prior_phases:
        return ""

    results = await retrieve_context(
        db=db,
        project_id=project_id,
        query=query,
        top_k=top_k,
        phase_filter=prior_phases,
    )

    if not results:
        return ""

    context_parts = []
    for r in results:
        phase_label = r["phase"].upper()
        context_parts.append(f"[{phase_label}] {r['text']}")

    return "\n\n".join(context_parts)
