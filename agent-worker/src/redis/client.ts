import Redis from "ioredis"
import { config } from "../config"
import { logger } from "../logger"

let _redis: Redis | null = null
let _subRedis: Redis | null = null

export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(config.REDIS_URL, {
      lazyConnect: false,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
    })
    _redis.on("error", (err) => logger.error("Redis error", { error: err.message }))
    _redis.on("connect", () => logger.info("Redis connected"))
  }
  return _redis
}

// Separate client for blocking operations (BLPOP) — cannot share with pub/sub
export function getBlockingRedis(): Redis {
  if (!_subRedis || _subRedis.status === "end" || _subRedis.status === "close") {
    _subRedis = new Redis(config.REDIS_URL, {
      lazyConnect: false,
      enableReadyCheck: true,
      maxRetriesPerRequest: null, // retry forever on blocking client
      retryStrategy: (times) => Math.min(times * 200, 3000),
    })
    _subRedis.on("error", (err) => logger.error("Blocking Redis error", { error: err.message }))
    _subRedis.on("close", () => { _subRedis = null })
  }
  return _subRedis
}

export async function disconnectRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit()
    _redis = null
  }
  if (_subRedis) {
    await _subRedis.quit()
    _subRedis = null
  }
}
