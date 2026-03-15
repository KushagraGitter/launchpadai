/**
 * Text chunking mirroring the Python pattern in backend/app/rag/embeddings.py.
 * Splits at sentence boundaries with 1000 char max and 100 char overlap.
 */

export interface Chunk {
  text: string
  metadata: Record<string, unknown>
}

export function chunkText(text: string, maxChunkSize = 1000, overlap = 100): string[] {
  if (!text) return []
  if (text.length <= maxChunkSize) return [text]

  const sentences = text.split(/(?<=[.!?])\s+/)
  const chunks: string[] = []
  let currentChunk: string[] = []
  let currentSize = 0

  for (const sentence of sentences) {
    const sentenceLen = sentence.length
    if (currentSize + sentenceLen > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.join(" "))
      // Build overlap from tail of current chunk
      const overlapSentences: string[] = []
      let overlapSize = 0
      for (let i = currentChunk.length - 1; i >= 0; i--) {
        if (overlapSize + currentChunk[i].length > overlap) break
        overlapSentences.unshift(currentChunk[i])
        overlapSize += currentChunk[i].length
      }
      currentChunk = overlapSentences
      currentSize = overlapSize
    }
    currentChunk.push(sentence)
    currentSize += sentenceLen
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(" "))
  }

  return chunks
}

export function chunkArtifact(
  title: string,
  content: string,
  metadata: Record<string, unknown> = {}
): Chunk[] {
  const texts = chunkText(content)
  return texts.map((text, i) => ({
    text,
    metadata: {
      title,
      chunk_index: i,
      total_chunks: texts.length,
      ...metadata,
    },
  }))
}
