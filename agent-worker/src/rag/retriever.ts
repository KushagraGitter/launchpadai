/**
 * pgvector cosine-similarity retrieval.
 * Prisma doesn't natively support pgvector operators, so we use $queryRaw.
 */

import { getPrisma } from "../db/client"
import { generateEmbedding, toVectorLiteral } from "./embeddings"
import { logger } from "../logger"

interface EmbeddingRow {
  id: string
  chunk_text: string
  phase_type: string
  metadata: Record<string, unknown> | null
  similarity: number
}

export async function retrieveContext(
  projectId: string,
  query: string,
  priorPhases: string[],
  topK = 15
): Promise<EmbeddingRow[]> {
  if (priorPhases.length === 0) return []

  const vector = await generateEmbedding(query)
  const vectorLiteral = toVectorLiteral(vector)

  try {
    const prisma = getPrisma()
    // Must use template literal form with Prisma.sql for $queryRaw type safety,
    // but pgvector cast syntax needs raw SQL — use $queryRawUnsafe with parameterized query.
    const rows = await prisma.$queryRawUnsafe<EmbeddingRow[]>(
      `SELECT id::text, chunk_text, phase_type, metadata,
              1 - (embedding <=> $1::vector) AS similarity
       FROM embeddings
       WHERE project_id = $2::uuid
         AND phase_type = ANY($3::text[])
       ORDER BY embedding <=> $1::vector
       LIMIT $4`,
      vectorLiteral,
      projectId,
      priorPhases,
      topK
    )
    return rows
  } catch (err) {
    logger.error("RAG retrieval failed", { projectId, error: String(err) })
    return []
  }
}

/**
 * Retrieve and format prior phase context as a string for agent prompts.
 * Mirrors Python's get_phase_context() in backend/app/rag/retriever.py.
 */
export async function getPhaseContext(
  projectId: string,
  query: string,
  priorPhases: string[]
): Promise<string> {
  const rows = await retrieveContext(projectId, query, priorPhases)
  if (rows.length === 0) return ""

  return rows
    .map((r) => `[${r.phase_type.toUpperCase()}] ${r.chunk_text}`)
    .join("\n\n")
}
