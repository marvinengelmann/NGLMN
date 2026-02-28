import * as Sentry from "@sentry/node"
import { differenceInSeconds, parseISO } from "date-fns"
import { count, sql } from "drizzle-orm"
import { hasEmailConfig, hasXConfig } from "@/config/env.ts"
import { getBudgetState } from "@/core/budget.ts"
import { db } from "@/db/client.ts"
import { personalityDna, semanticMemory } from "@/db/schema.ts"
import type { HealthCheckResult, OverallStatus, ProcessStatus, ServiceStatus } from "@/health/types.ts"
import { getRef } from "@/integrations/github.ts"
import { pingResend } from "@/integrations/resend.ts"
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

async function collectHealthStatus(): Promise<HealthCheckResult> {
  const errors: string[] = []

  let redisStatus: ServiceStatus = "error"
  try {
    redisStatus = (await pingRedis()) ? "ok" : "error"
  } catch (e) {
    captureError(e, { service: "redis" })
    errors.push(`Redis: ${e instanceof Error ? e.message : String(e)}`)
  }

  let postgresStatus: ServiceStatus = "error"
  try {
    await db.execute(sql`SELECT 1`)
    postgresStatus = "ok"
  } catch (e) {
    captureError(e, { service: "postgres" })
    errors.push(`Postgres: ${e instanceof Error ? e.message : String(e)}`)
  }

  let telegramStatus: ServiceStatus = "error"
  try {
    telegramStatus = (await pingTelegram()) ? "ok" : "error"
  } catch (e) {
    captureError(e, { service: "telegram" })
    errors.push(`Telegram: ${e instanceof Error ? e.message : String(e)}`)
  }

  let resendStatus: ServiceStatus | undefined
  try {
    if (hasEmailConfig()) {
      resendStatus = (await pingResend()) ? "ok" : "error"
    }
  } catch (e) {
    captureError(e, { service: "resend" })
    errors.push(`Resend: ${e instanceof Error ? e.message : String(e)}`)
    resendStatus = "error"
  }

  let vectorStatus: ServiceStatus = "error"
  try {
    await vectorIndex.info()
    vectorStatus = "ok"
  } catch (e) {
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
    captureError(e, { service: "process" })
    errors.push(`Process: ${e instanceof Error ? e.message : String(e)}`)
  }

  let budgetConsumed = 0
  let budgetLimit = 8.0
  let budgetCompliant = false
  try {
    const budget = await getBudgetState()
    budgetConsumed = budget.consumedToday
    budgetLimit = budget.dailyLimit
    budgetCompliant = budget.consumedToday <= budget.dailyLimit
  } catch (e) {
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
    captureError(e, { service: "semantic" })
    errors.push(`Semantic: ${e instanceof Error ? e.message : String(e)}`)
  }

  try {
    const dnaResult = await db.select({ value: count() }).from(personalityDna)
    if ((dnaResult[0]?.value ?? 0) === 0) {
      errors.push("Personality DNA: no entries in database")
    }
  } catch (e) {
    captureError(e, { service: "personality_dna" })
    errors.push(`Personality DNA: ${e instanceof Error ? e.message : String(e)}`)
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
    captureError(e, { service: "emotional_state" })
    errors.push(`Emotional state: ${e instanceof Error ? e.message : String(e)}`)
  }

  let xStatus: ServiceStatus | undefined
  try {
    if (hasXConfig()) {
      const { pingX } = await import("@/integrations/x.ts")
      xStatus = (await pingX()) ? "ok" : "error"
    }
  } catch (e) {
    captureError(e, { service: "x" })
    errors.push(`X: ${e instanceof Error ? e.message : String(e)}`)
    xStatus = "error"
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
    resendStatus === "error" ||
    xStatus === "error" ||
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
      vector: vectorStatus,
      resend: resendStatus,
      x: xStatus
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
