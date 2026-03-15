/**
 * Main orchestrator for a single phase execution:
 * 1. Fetch phase + project from DB
 * 2. Set phase status = "running"
 * 3. Retrieve RAG context from prior phases
 * 4. Publish phase_start event
 * 5. Pre-create AgentRun stubs
 * 6. Select and invoke the LangGraph for this phase type
 * 7. Store artifacts + embeddings
 * 8. Mark phase "completed"
 * On error: mark "failed", publish phase_error
 */

import { getPrisma } from "../db/client"
import { getPhaseContext } from "../rag/retriever"
import { getChatSummary } from "../context/chat-summary"
import { getPhaseFeedback } from "../context/feedback"
import { buildDiscoveryGraph } from "../graphs/discovery"
import { buildValidationGraph } from "../graphs/validation"
import { buildPrdGraph } from "../graphs/prd"
import { buildCodingContextGraph } from "../graphs/coding-context"
import { buildGtmGraph } from "../graphs/gtm"
import { storeArtifacts, createAgentRunStubs } from "../artifacts/store"
import * as publisher from "../redis/publisher"
import { logger } from "../logger"
import type { PhaseState, ProjectData } from "../types"
import type { PhaseStateType } from "../graphs/state"

const PRIOR_PHASES: Record<string, string[]> = {
  discovery: [],
  validation: ["discovery"],
  prd: ["discovery", "validation"],
  coding_context: ["discovery", "validation", "prd"],
  gtm: ["discovery", "validation", "prd", "coding_context"],
}

const PHASE_AGENT_LABELS: Record<string, string[]> = {
  discovery: [
    "Problem Explorer",
    "Assumption Challenger",
    "Opportunity Mapper",
    "Brief Builder",
  ],
  validation: [
    "Market Size Research",
    "Competitor Analysis",
    "Technical Feasibility",
    "Persona Research",
    "Validation Synthesis",
  ],
  prd: [
    "Requirements Analyst",
    "User Story Mapper",
    "Feature Prioritizer",
    "UX Flow Designer",
    "PRD Writer",
  ],
  coding_context: [
    "System Architect",
    "Schema Designer",
    "Task Decomposer",
    ".cursorrules Generator",
    "Context Packager",
  ],
  gtm: [
    "Positioning Strategist",
    "Channel Strategist",
    "Content Strategist",
    "Launch Planner",
    "GTM Playbook Assembler",
  ],
}

function getGraph(phaseType: string) {
  switch (phaseType) {
    case "discovery":
      return buildDiscoveryGraph()
    case "validation":
      return buildValidationGraph()
    case "prd":
      return buildPrdGraph()
    case "coding_context":
      return buildCodingContextGraph()
    case "gtm":
      return buildGtmGraph()
    default:
      throw new Error(`Unknown phase type: ${phaseType}`)
  }
}

export async function runPhase(phaseId: string): Promise<void> {
  const prisma = getPrisma()

  // 1. Fetch phase
  const phase = await prisma.phase.findUnique({
    where: { id: phaseId },
    include: { project: true },
  })

  if (!phase) {
    logger.error("Phase not found", { phaseId })
    return
  }

  const project = phase.project
  // Normalize DB enum (e.g. "CODING_CONTEXT") to lowercase ("coding_context")
  const phaseType = phase.phaseType.toLowerCase()

  const agentLabels = PHASE_AGENT_LABELS[phaseType] ?? []

  const phaseState: PhaseState = {
    projectId: project.id,
    phaseId: phase.id,
    phaseType,
    projectData: {
      id: project.id,
      name: project.name,
      rawIdea: project.rawIdea,
      domain: project.domain,
      targetAudience: project.targetAudience,
    } as ProjectData,
    ragContext: "",
    nodeResults: {},
    errors: [],
  }

  // 2. Mark phase running
  await prisma.phase.update({
    where: { id: phaseId },
    data: { status: "running", startedAt: new Date() },
  })

  try {
    // 3. Retrieve RAG context from prior phases
    const priorPhases = PRIOR_PHASES[phaseType] ?? []
    if (priorPhases.length > 0) {
      phaseState.ragContext = await getPhaseContext(project.id, project.rawIdea, priorPhases)
      logger.info("RAG context retrieved", {
        phaseId,
        priorPhases,
        contextLength: phaseState.ragContext.length,
      })
    }

    // 3b. Fetch chat context and user feedback in parallel
    const [chatContext, userFeedback] = await Promise.all([
      getChatSummary(project.id),
      getPhaseFeedback(phase.id, project.id, phaseType),
    ])

    if (chatContext) {
      logger.info("Chat context injected", { phaseId, contextLength: chatContext.length })
    }
    if (userFeedback) {
      logger.info("User feedback injected", { phaseId, feedbackLength: userFeedback.length })
    }

    // 4. Publish phase_start
    await publisher.phaseStart(phaseState, agentLabels)

    // 5. Pre-create AgentRun stubs
    await createAgentRunStubs(phaseId, phaseType, agentLabels)

    // 6. Build and invoke graph
    const graph = getGraph(phaseType)

    logger.info("Invoking LangGraph", { phaseId, phaseType })

    const initialState: PhaseStateType = {
      projectId: project.id,
      phaseId: phase.id,
      phaseType,
      projectData: phaseState.projectData,
      ragContext: phaseState.ragContext,
      chatContext,
      userFeedback,
      nodeResults: {},
      errors: [],
    }

    const finalState = await graph.invoke(initialState)

    logger.info("LangGraph completed", {
      phaseId,
      nodesRun: Object.keys(finalState.nodeResults).length,
      errors: finalState.errors.length,
    })

    // 7. Store artifacts + embeddings
    await storeArtifacts(phaseId, project.id, phaseType, finalState.nodeResults)

    // 8. Mark phase as in_review (user must accept before next phase unlocks)
    await prisma.phase.update({
      where: { id: phaseId },
      data: { status: "in_review", completedAt: new Date() },
    })

    await publisher.phaseInReview(phaseState)
    logger.info("Phase moved to in_review", { phaseId, phaseType })
  } catch (err) {
    const errorMsg = String(err)
    logger.error("Phase execution failed", { phaseId, phaseType, error: errorMsg })

    await publisher.phaseError(phaseState, errorMsg)

    try {
      await prisma.phase.update({
        where: { id: phaseId },
        data: { status: "failed", completedAt: new Date() },
      })

      // Create a system error agent run for visibility
      await prisma.agentRun.create({
        data: {
          phaseId,
          crewName: phaseType,
          agentName: "system",
          status: "failed",
          completedAt: new Date(),
          outputSummary: errorMsg.slice(0, 1000),
        },
      })
    } catch (dbErr) {
      logger.error("Failed to update phase status after error", { phaseId, error: String(dbErr) })
    }

    throw err
  }
}
