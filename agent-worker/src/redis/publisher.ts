/**
 * Publishes agent progress events to Redis pub/sub.
 * Event schema must exactly match Python's PhaseCallbackHandler in backend/app/agents/base.py
 * Channel: agent_progress:{projectId}
 */

import { getRedis } from "./client"
import { logger } from "../logger"
import type { PhaseState } from "../types"

function channel(projectId: string): string {
  return `agent_progress:${projectId}`
}

function now(): string {
  return new Date().toISOString()
}

async function publish(projectId: string, phaseId: string, event: Record<string, unknown>): Promise<void> {
  const payload = {
    ...event,
    phase_id: phaseId,
    project_id: projectId,
    timestamp: now(),
  }
  try {
    await getRedis().publish(channel(projectId), JSON.stringify(payload))
  } catch (err) {
    logger.warn("Failed to publish Redis event", { event: event.type, error: String(err) })
  }
}

export async function phaseStart(state: PhaseState, agentLabels: string[]): Promise<void> {
  await publish(state.projectId, state.phaseId, {
    type: "phase_start",
    phase_type: state.phaseType,
    agents: agentLabels,
  })
}

export async function agentStart(state: PhaseState, agentLabel: string, task: string): Promise<void> {
  await publish(state.projectId, state.phaseId, {
    type: "agent_start",
    agent: agentLabel,
    task: task.slice(0, 200),
  })
}

export async function agentThinking(state: PhaseState, agentLabel: string, thought: string): Promise<void> {
  await publish(state.projectId, state.phaseId, {
    type: "agent_thinking",
    agent: agentLabel,
    thought: thought.slice(0, 300),
  })
}

export async function agentComplete(state: PhaseState, agentLabel: string, summary: string): Promise<void> {
  await publish(state.projectId, state.phaseId, {
    type: "agent_complete",
    agent: agentLabel,
    summary: summary.slice(0, 500),
  })
}

export async function phaseComplete(state: PhaseState): Promise<void> {
  await publish(state.projectId, state.phaseId, {
    type: "phase_complete",
    phase_type: state.phaseType,
  })
}

export async function phaseInReview(state: PhaseState): Promise<void> {
  await publish(state.projectId, state.phaseId, {
    type: "phase_in_review",
    phase_type: state.phaseType,
  })
}

export async function phaseError(state: PhaseState, error: string): Promise<void> {
  await publish(state.projectId, state.phaseId, {
    type: "phase_error",
    phase_type: state.phaseType,
    error: error.slice(0, 500),
  })
}
