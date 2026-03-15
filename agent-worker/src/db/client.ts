import { PrismaClient } from "@prisma/client"
import { logger } from "../logger"

let _prisma: PrismaClient | null = null

export function getPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient({
      log: [
        { emit: "event", level: "error" },
        { emit: "event", level: "warn" },
      ],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(_prisma as any).$on("error", (e: { message: string; target: string }) =>
      logger.error("Prisma error", { message: e.message, target: e.target })
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(_prisma as any).$on("warn", (e: { message: string; target: string }) =>
      logger.warn("Prisma warning", { message: e.message, target: e.target })
    )
  }
  return _prisma
}

export async function disconnectPrisma(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect()
    _prisma = null
  }
}
