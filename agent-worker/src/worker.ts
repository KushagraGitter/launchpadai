/**
 * Redis BLPOP consumer loop.
 * Listens on QUEUE_NAME (ideaos:phase_jobs_v2) for phase job objects: { phase_id: string }
 *
 * Concurrency model:
 *   - The loop fires jobs as concurrent promises (non-blocking).
 *   - A semaphore caps simultaneous executions at MAX_CONCURRENT_JOBS (default 50).
 *   - When the semaphore is full the loop pauses on `acquire()` — backpressure
 *     keeps unstarted jobs safely in Redis rather than in memory.
 */

import { config } from "./config"
import { getBlockingRedis } from "./redis/client"
import { runPhase } from "./runner/phase-runner"
import { logger } from "./logger"
import type { PhaseJob } from "./types"

class Semaphore {
  private permits: number
  private queue: Array<() => void> = []

  constructor(permits: number) {
    this.permits = permits
  }

  acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--
      return Promise.resolve()
    }
    return new Promise((resolve) => this.queue.push(resolve))
  }

  release(): void {
    const next = this.queue.shift()
    if (next) {
      next()
    } else {
      this.permits++
    }
  }

  get active(): number {
    return config.MAX_CONCURRENT_JOBS - this.permits - this.queue.length
  }

  get waiting(): number {
    return this.queue.length
  }
}

export async function startWorker(): Promise<void> {
  const sem = new Semaphore(config.MAX_CONCURRENT_JOBS)
  logger.info("LaunchPadAI v2 Worker started", {
    queue: config.QUEUE_NAME,
    maxConcurrentJobs: config.MAX_CONCURRENT_JOBS,
  })

  while (true) {
    try {
      // Acquire a slot BEFORE popping — if all slots are full this blocks here,
      // leaving the job safely in Redis instead of piling up in memory.
      await sem.acquire()

      const redis = getBlockingRedis()
      const result = await redis.blpop(config.QUEUE_NAME, config.BLPOP_TIMEOUT)

      if (!result) {
        sem.release()
        continue
      }

      const [, jobData] = result
      let job: PhaseJob
      try {
        job = JSON.parse(jobData) as PhaseJob
      } catch {
        logger.error("Failed to parse job payload", { raw: jobData })
        sem.release()
        continue
      }

      if (!job.phase_id) {
        logger.error("Job missing phase_id", { job })
        sem.release()
        continue
      }

      // Fire-and-forget: loop immediately continues to pick up the next job.
      const phaseId = job.phase_id
      logger.info("Processing phase", {
        phaseId,
        activeJobs: sem.active,
        waitingJobs: sem.waiting,
      })

      runPhase(phaseId)
        .then(() => logger.info("Phase completed", { phaseId }))
        .catch((err) => logger.error("Phase execution failed", { phaseId, error: String(err) }))
        .finally(() => sem.release())
    } catch (err) {
      sem.release()
      if ((err as NodeJS.ErrnoException).code === "ERR_USE_AFTER_DESTROY") {
        break
      }
      logger.error("Worker loop error", { error: String(err) })
      await new Promise((r) => setTimeout(r, 5000))
    }
  }
}
