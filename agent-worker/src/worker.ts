/**
 * Redis BLPOP consumer loop.
 * Listens on QUEUE_NAME (ideaos:phase_jobs_v2) for phase job objects: { phase_id: string }
 */

import { config } from "./config"
import { getBlockingRedis } from "./redis/client"
import { runPhase } from "./runner/phase-runner"
import { logger } from "./logger"
import type { PhaseJob } from "./types"

export async function startWorker(): Promise<void> {
  logger.info("LaunchPadAI v2 Worker started", { queue: config.QUEUE_NAME })

  while (true) {
    try {
      // Re-fetch each iteration so reconnection works after connection drops
      const redis = getBlockingRedis()
      // BLPOP returns [key, value] or null on timeout
      const result = await redis.blpop(config.QUEUE_NAME, config.BLPOP_TIMEOUT)
      if (!result) continue

      const [, jobData] = result
      let job: PhaseJob
      try {
        job = JSON.parse(jobData) as PhaseJob
      } catch {
        logger.error("Failed to parse job payload", { raw: jobData })
        continue
      }

      if (!job.phase_id) {
        logger.error("Job missing phase_id", { job })
        continue
      }

      logger.info("Processing phase", { phaseId: job.phase_id })
      try {
        await runPhase(job.phase_id)
        logger.info("Phase completed", { phaseId: job.phase_id })
      } catch (err) {
        logger.error("Phase execution failed", { phaseId: job.phase_id, error: String(err) })
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ERR_USE_AFTER_DESTROY") {
        // Worker is shutting down
        break
      }
      logger.error("Worker loop error", { error: String(err) })
      // Brief back-off before retrying
      await new Promise((r) => setTimeout(r, 5000))
    }
  }
}
