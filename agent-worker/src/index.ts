import "dotenv/config"
import { configureLangSmith } from "./config"
import { startWorker } from "./worker"
import { disconnectPrisma } from "./db/client"
import { disconnectRedis } from "./redis/client"
import { logger } from "./logger"

configureLangSmith()

async function main(): Promise<void> {
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully…`)
    await disconnectRedis()
    await disconnectPrisma()
    process.exit(0)
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"))
  process.on("SIGINT", () => shutdown("SIGINT"))

  try {
    await startWorker()
  } catch (err) {
    logger.error("Fatal worker error", { error: String(err) })
    await disconnectRedis()
    await disconnectPrisma()
    process.exit(1)
  }
}

main()
