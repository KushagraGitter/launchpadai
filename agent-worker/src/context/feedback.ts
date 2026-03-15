/**
 * Fetches PhaseFeedback from the most recent in_review or accepted run of the
 * same phase type and formats it into a context string for agent prompts.
 * This ensures both full and targeted phase runs incorporate user feedback.
 */

import { getPrisma } from "../db/client"
import { logger } from "../logger"

export async function getPhaseFeedback(
  currentPhaseId: string,
  projectId: string,
  phaseType: string,
): Promise<string> {
  const prisma = getPrisma()

  // Prisma PhaseType enum uses uppercase; normalize for the query
  const dbPhaseType = phaseType.toUpperCase() as
    | "DISCOVERY"
    | "VALIDATION"
    | "PRD"
    | "CODING_CONTEXT"
    | "GTM"

  // Find the most recent reviewable phase of the same type (excluding the current run)
  const sourcePhase = await prisma.phase.findFirst({
    where: {
      projectId,
      phaseType: dbPhaseType,
      status: { in: ["in_review", "accepted"] },
      id: { not: currentPhaseId },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })

  if (!sourcePhase) return ""

  const feedbackItems = await prisma.phaseFeedback.findMany({
    where: { phaseId: sourcePhase.id },
    orderBy: { createdAt: "asc" },
    select: {
      feedbackType: true,
      section: true,
      comment: true,
    },
  })

  if (feedbackItems.length === 0) return ""

  const lines: string[] = ["=== USER FEEDBACK ON PREVIOUS DRAFT ==="]

  for (const fb of feedbackItems) {
    const typeLabel = fb.feedbackType.toUpperCase()
    let line = `- [${typeLabel}] Section: "${fb.section}"`
    if (fb.comment) {
      line += ` — Comment: ${fb.comment}`
    }
    lines.push(line)
  }

  lines.push("=== END USER FEEDBACK ===")
  lines.push(
    "Please address the user's feedback above, especially sections marked THUMBS_DOWN or with comments.",
  )

  logger.info("Phase feedback loaded", {
    projectId,
    phaseType,
    sourcePhaseId: sourcePhase.id,
    feedbackCount: feedbackItems.length,
  })

  return lines.join("\n")
}
