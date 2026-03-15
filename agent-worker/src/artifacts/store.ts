/**
 * Persists NodeResults to the database as Artifact and AgentRun rows,
 * then chunks and embeds the artifact text into pgvector.
 */

import { getPrisma } from "../db/client"
import { chunkArtifact } from "./chunker"
import { generateEmbeddings } from "../rag/embeddings"
import { logger } from "../logger"
import type { NodeResult } from "../types"

export async function storeArtifacts(
  phaseId: string,
  projectId: string,
  phaseType: string,
  nodeResults: Record<string, NodeResult>
): Promise<void> {
  const prisma = getPrisma()

  for (const [, result] of Object.entries(nodeResults)) {
    if (!result.content && !result.error) continue

    try {
      // Create Artifact row
      const artifact = await prisma.artifact.create({
        data: {
          phaseId,
          agentName: result.agentLabel,
          artifactType: `${phaseType}_report`,
          title: `${result.agentLabel} Output`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: result.contentJson as any,
          markdownContent: result.content || null,
        },
      })

      // Update AgentRun to completed
      await prisma.agentRun.updateMany({
        where: {
          phaseId,
          agentName: result.agentLabel,
          status: { in: ["queued", "running"] },
        },
        data: {
          status: result.error ? "failed" : "completed",
          completedAt: result.completedAt,
          outputSummary: result.content.slice(0, 1000) || result.error?.slice(0, 1000),
          tokenUsage: { estimated: result.tokensUsed },
        },
      })

      // Chunk and embed artifact text
      if (result.content) {
        const chunks = chunkArtifact(artifact.title, result.content, {
          phase: phaseType,
          agent: result.agentLabel,
          node: result.nodeName,
        })

        if (chunks.length > 0) {
          const texts = chunks.map((c) => c.text)
          const vectors = await generateEmbeddings(texts)

          for (let i = 0; i < chunks.length; i++) {
            const vectorLiteral = "[" + vectors[i].join(",") + "]"
            // Use raw SQL because Prisma doesn't support pgvector insert natively
            await prisma.$executeRawUnsafe(
              `INSERT INTO embeddings (id, artifact_id, project_id, phase_type, chunk_text, embedding, metadata, created_at)
               VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, $5::vector, $6::jsonb, NOW())`,
              artifact.id,
              projectId,
              phaseType,
              chunks[i].text,
              vectorLiteral,
              JSON.stringify(chunks[i].metadata)
            )
          }

          logger.info("Stored embeddings for artifact", {
            artifactId: artifact.id,
            chunks: chunks.length,
            node: result.nodeName,
          })
        }
      }
    } catch (err) {
      logger.error("Failed to store artifact", {
        nodeName: result.nodeName,
        phaseId,
        error: String(err),
      })
      // Continue with other nodes rather than failing the whole phase
    }
  }
}

export async function createAgentRunStubs(
  phaseId: string,
  phaseType: string,
  agentLabels: string[]
): Promise<void> {
  const prisma = getPrisma()
  await prisma.agentRun.createMany({
    data: agentLabels.map((label) => ({
      phaseId,
      crewName: phaseType,
      agentName: label,
      status: "queued",
    })),
    skipDuplicates: true,
  })
}
