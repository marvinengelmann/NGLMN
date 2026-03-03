import * as Sentry from "@sentry/node"
import { differenceInSeconds, parseISO } from "date-fns"
import { count, sql } from "drizzle-orm"
import { BUDGET } from "@/config/constants.ts"
import { getBudgetState } from "@/core/budget.ts"
import { db } from "@/db/client.ts"
import { semanticMemory } from "@/db/schema.ts"
import type { HealthCheckResult, OverallStatus, ProcessStatus, ServiceStatus } from "@/health/types.ts"
import { getRef } from "@/integrations/github.ts"
import { pingTelegram } from "@/integrations/telegram.ts"
import { vectorIndex } from "@/integrations/vector.ts"
import { log } from "@/lib/logger.ts"
import { captureError } from "@/lib/sentry.ts"
import { nowISO } from "@/lib/time.ts"
import {
  getCurrentEmotion,
  getLastTickSummary,
  pingRedis,
  setHealthCheck,
  setLastHealthyCommit
} from "@/memory/working.ts"
import { validateEmotionalState } from "@/security/guardian.ts"

/**
 * Runs the full health check lifecycle: check all services, persist result,
 * track healthy commits, alert on critical, and log outcome.
 */
export async function runHealthCheck(): Promise<HealthCheckResult> {
  const result = await collectHealthStatus()
  await setHealthCheck(result)

  if (result.overall === "healthy") {
    try {
      const ref = await getRef("heads/master")
      await setLastHealthyCommit(ref.sha)
    } catch (e) {
      log.debug("GitHub healthy commit update skipped", { error: String(e) })
    }
  }

  if (result.overall === "critical") {
    Sentry.captureMessage("Health check critical", {
      level: "fatal",
      extra: {
        errors: result.errors,
        services: result.services,
        process: result.process,
        budget: result.budget,
        memory: result.memory
      }
    })
  }

  if (result.errors.length > 0) {
    log.warn("Health check completed with issues", { overall: result.overall, errors: result.errors })
  } else {
    log.info("Health check OK", { overall: result.overall })
  }

  return result
}

export async function collectHealthStatus(): Promise<HealthCheckResult> {
  const errors: string[] = []

  let redisStatus: ServiceStatus = "error"
  try {
    redisStatus = (await pingRedis()) ? "ok" : "error"
  } catch (e) {
    log.error("Health check: Redis failed", { error: e instanceof Error ? e.message : String(e) })
    captureError(e, { service: "redis" })
    errors.push(`Redis: ${e instanceof Error ? e.message : String(e)}`)
  }

  let postgresStatus: ServiceStatus = "error"
  try {
    await db.execute(sql`SELECT 1`)
    postgresStatus = "ok"
  } catch (e) {
    log.error("Health check: Postgres failed", { error: e instanceof Error ? e.message : String(e) })
    captureError(e, { service: "postgres" })
    errors.push(`Postgres: ${e instanceof Error ? e.message : String(e)}`)
  }

  let telegramStatus: ServiceStatus = "error"
  try {
    telegramStatus = (await pingTelegram()) ? "ok" : "error"
  } catch (e) {
    log.error("Health check: Telegram failed", { error: e instanceof Error ? e.message : String(e) })
    captureError(e, { service: "telegram" })
    errors.push(`Telegram: ${e instanceof Error ? e.message : String(e)}`)
  }

  let vectorStatus: ServiceStatus = "error"
  try {
    await vectorIndex.info()
    vectorStatus = "ok"
  } catch (e) {
    log.error("Health check: Vector failed", { error: e instanceof Error ? e.message : String(e) })
    captureError(e, { service: "vector" })
    errors.push(`Vector: ${e instanceof Error ? e.message : String(e)}`)
  }

  let lastTickRecency: ProcessStatus = "dead"
  let lastTickAgeSeconds = Infinity
  try {
    const lastTick = await getLastTickSummary()
    if (lastTick) {
      lastTickAgeSeconds = differenceInSeconds(new Date(), parseISO(lastTick.timestamp))
      const intervalSeconds = 300
      const okThreshold = intervalSeconds * 2
      const staleThreshold = intervalSeconds * 4
      if (lastTickAgeSeconds < okThreshold) lastTickRecency = "ok"
      else if (lastTickAgeSeconds < staleThreshold) lastTickRecency = "stale"
      else lastTickRecency = "dead"
    }
  } catch (e) {
    log.error("Health check: Process failed", { error: e instanceof Error ? e.message : String(e) })
    captureError(e, { service: "process" })
    errors.push(`Process: ${e instanceof Error ? e.message : String(e)}`)
  }

  let budgetConsumed = 0
  let budgetLimit: number = BUDGET.DAILY_LIMIT
  let budgetCompliant = false
  try {
    const budget = await getBudgetState()
    budgetConsumed = budget.consumedToday
    budgetLimit = budget.dailyLimit
    budgetCompliant = budget.consumedToday <= budget.dailyLimit
  } catch (e) {
    log.error("Health check: Budget failed", { error: e instanceof Error ? e.message : String(e) })
    captureError(e, { service: "budget" })
    errors.push(`Budget: ${e instanceof Error ? e.message : String(e)}`)
  }

  let semanticStatus: ServiceStatus = "error"
  let semanticCount = 0
  try {
    const result = await db.select({ value: count() }).from(semanticMemory)
    semanticCount = result[0]?.value ?? 0
    semanticStatus = "ok"
  } catch (e) {
    log.error("Health check: Semantic failed", { error: e instanceof Error ? e.message : String(e) })
    captureError(e, { service: "semantic" })
    errors.push(`Semantic: ${e instanceof Error ? e.message : String(e)}`)
  }

  let emotionBlocked = false
  try {
    const emotionState = await getCurrentEmotion()
    if (emotionState) {
      const emotionCheck = validateEmotionalState(emotionState)
      if (emotionCheck.verdict === "blocked") {
        emotionBlocked = true
        errors.push(...emotionCheck.reasons)
      }
    }
  } catch (e) {
    log.error("Health check: EmotionalState failed", { error: e instanceof Error ? e.message : String(e) })
    captureError(e, { service: "emotional_state" })
    errors.push(`Emotional state: ${e instanceof Error ? e.message : String(e)}`)
  }

  const criticalDown = redisStatus === "error" || postgresStatus === "error"
  const processDead = lastTickRecency === "dead"
  const budgetExceeded = !budgetCompliant

  let overall: OverallStatus = "healthy"
  if (criticalDown || processDead || budgetExceeded) {
    overall = "critical"
  } else if (
    telegramStatus === "error" ||
    vectorStatus === "error" ||
    lastTickRecency === "stale" ||
    semanticStatus === "error" ||
    emotionBlocked
  ) {
    overall = "degraded"
  }

  return {
    timestamp: nowISO(),
    overall,
    services: {
      redis: redisStatus,
      postgres: postgresStatus,
      telegram: telegramStatus,
      vector: vectorStatus
    },
    process: {
      lastTickRecency,
      lastTickAgeSeconds: lastTickAgeSeconds === Infinity ? -1 : lastTickAgeSeconds
    },
    budget: {
      consumed: budgetConsumed,
      limit: budgetLimit,
      compliant: budgetCompliant
    },
    memory: {
      redis: redisStatus,
      postgres: postgresStatus,
      vector: vectorStatus,
      semantic: {
        status: semanticStatus,
        entryCount: semanticCount
      }
    },
    errors
  }
}
