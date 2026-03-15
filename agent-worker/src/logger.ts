import winston from "winston"
import { config } from "./config"

export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    config.NODE_ENV === "production"
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ level, message, timestamp, ...meta }) => {
            const metaStr = Object.keys(meta).length ? " " + JSON.stringify(meta) : ""
            return `${timestamp} [${level}] ${message}${metaStr}`
          })
        )
  ),
  transports: [new winston.transports.Console()],
})
