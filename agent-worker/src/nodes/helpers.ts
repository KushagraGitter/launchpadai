/**
 * Shared utilities used by every node.
 */

import { HumanMessage } from "@langchain/core/messages"
import { getLLM, type TaskType } from "../llm/router"
import { getTavilyTool } from "../llm/tools"
import * as publisher from "../redis/publisher"
import { logger } from "../logger"
import type { PhaseStateType } from "../graphs/state"
import type { NodeResult } from "../types"

const STREAM_FLUSH_CHARS = 50

export function buildContextPrompt(state: PhaseStateType, taskPrompt: string): string {
  const { projectData, ragContext, chatContext, userFeedback } = state
  const parts = [
    `Project: ${projectData.name}`,
    `Idea: ${projectData.rawIdea}`,
  ]
  if (projectData.domain) parts.push(`Domain: ${projectData.domain}`)
  if (projectData.targetAudience) parts.push(`Target Audience: ${projectData.targetAudience}`)
  if (ragContext) parts.push(`\n--- Prior Phase Context ---\n${ragContext}`)
  if (chatContext) parts.push(`\n--- User Conversation Context ---\n${chatContext}`)
  if (userFeedback) parts.push(`\n--- User Feedback on Previous Draft ---\n${userFeedback}`)
  parts.push(`\n--- Your Task ---\n${taskPrompt}`)
  return parts.join("\n")
}

export function tryParseJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return { raw_output: text }
  }
}

export function estimateTokens(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4)
}

export interface RunNodeOptions {
  state: PhaseStateType
  nodeName: string
  agentLabel: string
  taskDescription: string
  taskType: TaskType
  prompt: string
  useSearch?: boolean
}

/**
 * Runs an LLM node with streaming + Redis event publishing.
 * Handles token streaming, agent events, and error wrapping.
 */
export async function runNode(opts: RunNodeOptions): Promise<Partial<PhaseStateType>> {
  const { state, nodeName, agentLabel, taskDescription, taskType, prompt, useSearch } = opts

  await publisher.agentStart(state, agentLabel, taskDescription)

  let fullOutput = ""
  let buffer = ""

  try {
    const llm = getLLM(taskType)
    let searchContext = ""

    // If web search is requested and Tavily is available, run a search first
    if (useSearch) {
      const searchTool = getTavilyTool()
      if (searchTool) {
        try {
          const searchQuery = `${state.projectData.name} ${state.projectData.rawIdea} ${agentLabel}`
          const searchResult = await searchTool.invoke(searchQuery)
          searchContext = `\n--- Web Search Results ---\n${searchResult}\n`
        } catch (err) {
          logger.warn("Tavily search failed, continuing without web context", { error: String(err) })
        }
      }
    }

    const fullPrompt = searchContext ? prompt + searchContext : prompt
    const stream = await llm.stream([new HumanMessage(fullPrompt)])

    for await (const chunk of stream) {
      const token = typeof chunk.content === "string" ? chunk.content : ""
      fullOutput += token
      buffer += token
      if (buffer.length >= STREAM_FLUSH_CHARS) {
        await publisher.agentThinking(state, agentLabel, buffer)
        buffer = ""
      }
    }

    // Flush remaining buffer
    if (buffer.length > 0) {
      await publisher.agentThinking(state, agentLabel, buffer)
    }

    await publisher.agentComplete(state, agentLabel, fullOutput.slice(0, 500))

    const result: NodeResult = {
      nodeName,
      agentLabel,
      content: fullOutput,
      contentJson: tryParseJson(fullOutput),
      tokensUsed: estimateTokens(fullOutput),
      completedAt: new Date(),
    }

    return { nodeResults: { [nodeName]: result } }
  } catch (err) {
    const errorMsg = String(err)
    logger.error("Node execution failed", { nodeName, agentLabel, error: errorMsg })
    await publisher.agentComplete(state, agentLabel, `ERROR: ${errorMsg}`.slice(0, 500))

    const result: NodeResult = {
      nodeName,
      agentLabel,
      content: "",
      contentJson: { error: errorMsg },
      tokensUsed: 0,
      completedAt: new Date(),
      error: errorMsg,
    }

    return {
      nodeResults: { [nodeName]: result },
      errors: [errorMsg],
    }
  }
}
