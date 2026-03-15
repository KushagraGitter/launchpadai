import OpenAI from "openai"
import { config } from "../config"
import { logger } from "../logger"

let _client: OpenAI | null = null

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: config.OPENAI_API_KEY })
  }
  return _client
}

/**
 * Generate embeddings for a batch of texts.
 * Returns an array of 1536-dim vectors matching text-embedding-3-small.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  try {
    const response = await getClient().embeddings.create({
      input: texts,
      model: config.OPENAI_EMBEDDING_MODEL,
    })
    return response.data.map((item) => item.embedding)
  } catch (err) {
    logger.error("Failed to generate embeddings", { error: String(err) })
    throw err
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const results = await generateEmbeddings([text])
  return results[0]
}

/** Format a float array as a PostgreSQL vector literal: '[0.1,0.2,...]' */
export function toVectorLiteral(vector: number[]): string {
  return "[" + vector.join(",") + "]"
}
