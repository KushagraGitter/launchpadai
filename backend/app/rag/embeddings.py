"""Embedding generation and text chunking for the RAG pipeline."""

from __future__ import annotations

import re
from typing import Any

from openai import OpenAI

from app.core.config import settings

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a list of texts using OpenAI."""
    client = _get_client()
    response = client.embeddings.create(
        input=texts,
        model=settings.OPENAI_EMBEDDING_MODEL,
    )
    return [item.embedding for item in response.data]


def generate_embedding(text: str) -> list[float]:
    """Generate a single embedding vector."""
    return generate_embeddings([text])[0]


def chunk_text(text: str, max_chunk_size: int = 1000, overlap: int = 100) -> list[str]:
    """Split text into overlapping chunks at sentence boundaries."""
    if not text or len(text) <= max_chunk_size:
        return [text] if text else []

    sentences = re.split(r"(?<=[.!?])\s+", text)
    chunks: list[str] = []
    current_chunk: list[str] = []
    current_size = 0

    for sentence in sentences:
        sentence_len = len(sentence)
        if current_size + sentence_len > max_chunk_size and current_chunk:
            chunks.append(" ".join(current_chunk))
            overlap_text = " ".join(current_chunk)
            overlap_sentences: list[str] = []
            overlap_size = 0
            for s in reversed(current_chunk):
                if overlap_size + len(s) > overlap:
                    break
                overlap_sentences.insert(0, s)
                overlap_size += len(s)
            current_chunk = overlap_sentences
            current_size = overlap_size

        current_chunk.append(sentence)
        current_size += sentence_len

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks


def chunk_artifact(title: str, content: str, metadata: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Chunk an artifact's content and return chunk dicts with metadata."""
    chunks = chunk_text(content)
    result = []
    for i, chunk in enumerate(chunks):
        chunk_meta = {
            "title": title,
            "chunk_index": i,
            "total_chunks": len(chunks),
            **(metadata or {}),
        }
        result.append({"text": chunk, "metadata": chunk_meta})
    return result
