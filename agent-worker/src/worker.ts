/**
 * Redis BLPOP consumer — N concurrent slots, each with its own Redis connection.
 * Listens on QUEUE_NAME (ideaos:phase_jobs_v2) for phase job objects: { phase_id: string }
 *
 * Each slot is an independent async loop. All N slots run in parallel via Promise.all().
 * Jobs are claimed atomically by BLPOP — no job is processed twice across slots or replicas.
 */

import { config } from "./config"
import { createBlockingRedis } from "./redis/client"
import { runPhase } from "./runner/phase-runner"
import { logger } from "./logger"
import type { PhaseJob } from "./types"
import type Redis from "ioredis"

// ── Shutdown coordination ─────────────────────────────────────────────────────
let isShuttingDown = false
const slotRedisClients: Redis[] = []

/**
 * Signal all slots to stop accepting new jobs after their current job completes.
 * Called from the SIGTERM/SIGINT handler in index.ts.
 * Does NOT call process.exit() — startWorker() resolves naturally after all slots drain.
 */
export function signalShutdown(): void {
  isShuttingDown = true
  logger.info("Shutdown signal received — draining in-flight jobs")
}

// ── Per-slot consumer loop ────────────────────────────────────────────────────
async function runSlot(slotId: number): Promise<void> {
  const redis = createBlockingRedis()
  slotRedisClients.push(redis)
  logger.info("Worker slot started", { slotId, queue: config.QUEUE_NAME })

  while (!isShuttingDown) {
    try {
      // BLPOP blocks for up to BLPOP_TIMEOUT seconds, then returns null (timeout)
      const result = await redis.blpop(config.QUEUE_NAME, config.BLPOP_TIMEOUT)
      if (!result) continue // timeout — loop back and recheck isShuttingDown

      const [, jobData] = result
      let job: PhaseJob
      try {
        job = JSON.parse(jobData) as PhaseJob
      } catch {
        logger.error("Failed to parse job payload", { slotId, raw: jobData })
        continue
      }

      if (!job.phase_id) {
        logger.error("Job missing phase_id", { slotId, job })
        continue
      }

      logger.info("Processing phase", { slotId, phaseId: job.phase_id })
      try {
        await runPhase(job.phase_id)
        logger.info("Phase completed", { slotId, phaseId: job.phase_id })
      } catch (err) {
        // Error is contained — this slot continues to the next job
        logger.error("Phase execution failed", {
          slotId,
          phaseId: job.phase_id,
          error: String(err),
        })
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ERR_USE_AFTER_DESTROY") {
        // Redis connection was closed (normal during shutdown)
        break
      }
      logger.error("Slot loop error", { slotId, error: String(err) })
      // Brief back-off before retrying to avoid a tight loop on transient errors
      await new Promise((r) => setTimeout(r, 5000))
    }
  }

  logger.info("Worker slot exiting", { slotId })
}

// ── Main entry ────────────────────────────────────────────────────────────────
export async function startWorker(): Promise<void> {
  const concurrency = config.CONCURRENCY
  logger.info("LaunchPadAI v2 Worker started", {
    queue: config.QUEUE_NAME,
    concurrency,
  })

  // Launch N slots concurrently — each pulls from the same Redis queue independently
  const slotPromises = Array.from({ length: concurrency }, (_, i) => runSlot(i + 1))

  // Wait for ALL slots to drain before returning (enables graceful shutdown)
  await Promise.all(slotPromises)

  logger.info("All slots drained — cleaning up Redis connections")
  await Promise.all(slotRedisClients.map((r) => r.quit().catch(() => {})))
}
