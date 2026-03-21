import "dotenv/config"
import { configureLangSmith } from "./config"
import { startWorker, signalShutdown } from "./worker"
import { disconnectPrisma } from "./db/client"
import { disconnectRedis } from "./redis/client"
import { logger } from "./logger"

configureLangSmith()

async function main(): Promise<void> {
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, signaling graceful shutdown…`)
    // Signal slots to stop accepting new jobs — do NOT call process.exit() here.
    // startWorker() will resolve once all in-flight jobs complete, then finally runs cleanup.
    signalShutdown()
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"))
  process.on("SIGINT", () => shutdown("SIGINT"))

  try {
    await startWorker() // resolves only after all slots have drained
  } catch (err) {
    logger.error("Fatal worker error", { error: String(err) })
  } finally {
    await disconnectRedis()
    await disconnectPrisma()
    process.exit(0)
  }
}

main()
