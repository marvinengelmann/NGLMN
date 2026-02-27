import * as Sentry from "@sentry/node"
import { schedules } from "@trigger.dev/sdk"
import { differenceInSeconds, formatISO, parseISO } from "date-fns"
import { count, sql } from "drizzle-orm"
import { getBudgetState } from "@/core/budget.ts"
import { db } from "@/db/client.ts"
import { personalityDna, semanticMemory } from "@/db/schema.ts"
import { getRef } from "@/integrations/github.ts"
import { pingResend } from "@/integrations/resend.ts"
import { pingTelegram } from "@/integrations/telegram.ts"
import { vectorIndex } from "@/integrations/vector.ts"
import { log } from "@/lib/logger.ts"
import { captureError } from "@/lib/sentry.ts"
import {
  getCurrentEmotion,
  getLastTickSummary,
  pingRedis,
  setHealthCheck,
  setLastHealthyCommit
} from "@/memory/working.ts"
import { validateEmotionalState } from "@/security/guardian.ts"
import type { HealthCheckResult, OverallStatus, ProcessStatus, ServiceStatus } from "./types.ts"

/** Runs a comprehensive health check every 15 minutes. */
export const healthCheckTask = schedules.task({
  id: "health-check",
  cron: "*/15 * * * *",
  run: async () => {
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

    let resendStatus: ServiceStatus = "error"
    try {
      resendStatus = (await pingResend()) ? "ok" : "error"
    } catch (e) {
      captureError(e, { service: "resend" })
      errors.push(`Resend: ${e instanceof Error ? e.message : String(e)}`)
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
      const { hasXConfig } = await import("@/config/env.ts")
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

    const result: HealthCheckResult = {
      timestamp: formatISO(new Date()),
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

    await setHealthCheck(result)

    if (overall === "healthy") {
      try {
        const ref = await getRef("heads/master")
        await setLastHealthyCommit(ref.sha)
      } catch (e) {
        log.debug("GitHub healthy commit update skipped", { error: String(e) })
      }
    }

    if (overall === "critical") {
      Sentry.captureMessage("Health check critical", {
        level: "fatal",
        extra: {
          errors,
          services: result.services,
          process: result.process,
          budget: result.budget,
          memory: result.memory
        }
      })
    }

    if (errors.length > 0) {
      log.warn("Health check completed with issues", { overall, errors })
    } else {
      log.info("Health check OK", { overall })
    }

    return result
  }
})
