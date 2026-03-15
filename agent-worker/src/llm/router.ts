import { ChatOpenAI } from "@langchain/openai"
import { config } from "../config"

export type TaskType = "research" | "synthesis" | "formatting"

const MODEL_MAP: Record<TaskType, string> = {
  research: "gpt-4o",
  synthesis: "gpt-4o",
  formatting: "gpt-4o-mini",
}

/**
 * Returns a ChatOpenAI instance tiered by task complexity.
 * research/synthesis → gpt-4o
 * formatting         → gpt-4o-mini
 */
export function getLLM(taskType: TaskType): ChatOpenAI {
  return new ChatOpenAI({
    model: MODEL_MAP[taskType],
    apiKey: config.OPENAI_API_KEY,
    temperature: 0.7,
    streaming: true,
  })
}
