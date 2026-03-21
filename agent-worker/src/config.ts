import { z } from "zod"

const configSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  TAVILY_API_KEY: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  QUEUE_NAME: z.string().default("ideaos:phase_jobs_v2"),
  BLPOP_TIMEOUT: z.coerce.number().int().positive().default(5),
  CONCURRENCY: z.coerce.number().int().positive().default(3),
  LANGSMITH_API_KEY: z.string().optional(),
  LANGSMITH_PROJECT: z.string().default("LaunchPadAI"),
  LANGSMITH_TRACING: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  LANGSMITH_ENDPOINT: z.string().url().default("https://api.smith.langchain.com"),
})

function loadConfig() {
  const result = configSchema.safeParse(process.env)
  if (!result.success) {
    const missing = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")
    throw new Error(`Invalid configuration:\n${missing}`)
  }
  return result.data
}

export const config = loadConfig()
export type Config = typeof config

/**
 * Propagate LangSmith settings into the LANGCHAIN_* env vars that
 * @langchain/core reads automatically. Call once at startup.
 */
export function configureLangSmith(): void {
  if (!config.LANGSMITH_API_KEY) {
    return
  }
  process.env.LANGCHAIN_TRACING_V2 = config.LANGSMITH_TRACING ? "true" : "false"
  process.env.LANGCHAIN_API_KEY = config.LANGSMITH_API_KEY
  process.env.LANGCHAIN_PROJECT = config.LANGSMITH_PROJECT
  process.env.LANGCHAIN_ENDPOINT = config.LANGSMITH_ENDPOINT
}
