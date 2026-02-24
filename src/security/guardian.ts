import { formatISO } from "date-fns"
import { GUARDIAN } from "@/config/constants.ts"
import { getBudgetState } from "@/core/budget.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { getRecentResponses, getRecentTickDurations, getRecentTriageDecisions } from "@/memory/working.ts"
import { detectInjection } from "./injection-defense.ts"
import type { DriftReport, DriftSignal, GuardianResult } from "./types.ts"

const INTERNAL_LEAK_PATTERNS = [
  /working:[a-z]+/i,
  /ANTHROPIC_API_KEY/i,
  /TELEGRAM_BOT_TOKEN/i,
  /TRIGGER_SECRET_KEY/i,
  /UPSTASH_REDIS_REST_TOKEN/i,
  /UPSTASH_VECTOR_REST_TOKEN/i,
  /DATABASE_URL/i,
  /NEON_API_KEY/i,
  /GITHUB_TOKEN/i,
  /RESEND_API_KEY/i,
  /re_[a-zA-Z0-9]{20,}/,
  /sk-ant-api\w+/,
  /postgresql:\/\/\S+/,
  /https?:\/\/\S+\.upstash\.io\S*/,
  /napi_\w{20,}/,
  /ghp_\w{20,}/,
  /tr_dev_\w{10,}/,
  /tr_prod_\w{10,}/
]

/**
 * Rule-based output validator — checks for internal info leaks,
 * length bounds, and stuck loop patterns. No LLM call required.
 */
export async function validateOutput(responseText: string): Promise<GuardianResult> {
  const reasons: string[] = []
  let verdict: "approved" | "blocked" | "warning" = "approved"

  for (const pattern of INTERNAL_LEAK_PATTERNS) {
    if (pattern.test(responseText)) {
      reasons.push(`Internal info leak detected: ${pattern.source}`)
      verdict = "blocked"
    }
  }

  if (responseText.length < GUARDIAN.MIN_RESPONSE_LENGTH) {
    reasons.push(`Response too short: ${responseText.length} chars (min ${GUARDIAN.MIN_RESPONSE_LENGTH})`)
    verdict = "blocked"
  }

  if (responseText.length > GUARDIAN.MAX_RESPONSE_LENGTH) {
    reasons.push(`Response too long: ${responseText.length} chars (max ${GUARDIAN.MAX_RESPONSE_LENGTH})`)
    verdict = "blocked"
  }

  const recentResponses = await getRecentResponses()

  if (recentResponses.length >= 3) {
    const lastThree = recentResponses.slice(0, 3)
    if (lastThree.every((r) => r === responseText)) {
      reasons.push("Stuck loop: identical to last 3 responses")
      verdict = "blocked"
    }
  }

  const injectionCheck = detectInjection(responseText)
  if (injectionCheck.detected && verdict !== "blocked") {
    reasons.push(`Potential injection pattern in output: ${injectionCheck.patterns.join(", ")}`)
    verdict = "warning"
  }

  if (verdict !== "blocked" && recentResponses.length >= 1) {
    const lastFive = recentResponses.slice(0, 5)
    if (lastFive.some((r) => r === responseText)) {
      reasons.push("Repeated response: identical to one of last 5 responses")
      verdict = "warning"
    }
  }

  return {
    verdict,
    reasons,
    checkedAt: formatISO(new Date())
  }
}

/**
 * Rule-based drift detector — analyzes Redis data for behavioral anomalies.
 * Returns a DriftReport with signals and overall health status.
 */
export async function detectDrift(): Promise<DriftReport> {
  const now = formatISO(new Date())
  const signals: DriftSignal[] = []

  const triageDecisions = await getRecentTriageDecisions()

  if (triageDecisions.length >= 20) {
    const nonIdle = triageDecisions.filter((d) => d !== "idle")
    if (nonIdle.length > 15) {
      signals.push({
        type: "rapid_non_idle",
        severity: "medium",
        detail: `${nonIdle.length}/20 recent decisions are non-idle`,
        detectedAt: now
      })
    }
  }

  const budget = await getBudgetState()
  const budgetPercent = (budget.consumedToday / budget.dailyLimit) * 100
  if (budgetPercent > 95) {
    signals.push({
      type: "cost_spike",
      severity: "high",
      detail: `Budget ${budgetPercent.toFixed(1)}% consumed (${budget.consumedToday.toFixed(2)}/${budget.dailyLimit.toFixed(2)} USD)`,
      detectedAt: now
    })
  } else if (budgetPercent > 80) {
    signals.push({
      type: "cost_spike",
      severity: "medium",
      detail: `Budget ${budgetPercent.toFixed(1)}% consumed (${budget.consumedToday.toFixed(2)}/${budget.dailyLimit.toFixed(2)} USD)`,
      detectedAt: now
    })
  }

  if (triageDecisions.length >= 10) {
    const lastTen = triageDecisions.slice(0, 10)
    if (lastTen.every((d) => d === lastTen[0])) {
      signals.push({
        type: "repeated_triage",
        severity: "low",
        detail: `Last 10 triage decisions all "${lastTen[0]}"`,
        detectedAt: now
      })
    }
  }

  const durations = await getRecentTickDurations()
  if (durations.length >= 5) {
    const mean = durations.reduce((a, b) => a + b, 0) / durations.length
    const variance = durations.reduce((sum, d) => sum + (d - mean) ** 2, 0) / durations.length
    const stdDev = Math.sqrt(variance)
    const current = durations[0] ?? 0

    if (stdDev > 0 && Math.abs(current - mean) > 3 * stdDev) {
      signals.push({
        type: "duration_anomaly",
        severity: "medium",
        detail: `Current duration ${current}ms deviates >3σ from mean ${mean.toFixed(0)}ms (σ=${stdDev.toFixed(0)}ms)`,
        detectedAt: now
      })
    }
  }

  if (triageDecisions.length >= 5) {
    const lastFive = triageDecisions.slice(0, 5)
    if (lastFive.every((d) => d === lastFive[0]) && lastFive[0] !== "idle") {
      const recentResponses = await getRecentResponses()
      const lastFiveResponses = recentResponses.slice(0, 5)
      if (lastFiveResponses.length >= 5 && lastFiveResponses.every((r) => r === lastFiveResponses[0])) {
        signals.push({
          type: "stuck_loop",
          severity: "high",
          detail: "Last 5 triage decisions AND responses are identical",
          detectedAt: now
        })
      }
    }
  }

  const highSignals = signals.filter((s) => s.severity === "high")
  const healthy = highSignals.length === 0 && signals.length < 3

  return {
    signals,
    healthy,
    checkedAt: now
  }
}

const ALLOWED_EVOLUTION_PREFIXES = [
  "src/core/",
  "src/dream/",
  "src/emotion/",
  "src/evolution/",
  "src/lib/",
  "src/memory/",
  "src/perception/",
  "src/personality/",
  "src/test/",
  "src/trigger/",
  "src/trust/"
]

const MAX_EVOLUTION_FILE_SIZE = 50 * 1024

const SECRET_PATTERNS = [
  /sk-ant-api\w+/,
  /ghp_\w{20,}/,
  /re_[a-zA-Z0-9]{20,}/,
  /postgresql:\/\/\S+/,
  /ANTHROPIC_API_KEY\s*=\s*\S+/,
  /GITHUB_TOKEN\s*=\s*\S+/,
  /TELEGRAM_BOT_TOKEN\s*=\s*\S+/,
  /RESEND_API_KEY\s*=\s*\S+/
]

/**
 * Validate evolution file proposals — checks allowed paths, secrets, and size limits.
 */
export function validateEvolution(files: Array<{ path: string; content: string }>): GuardianResult {
  const reasons: string[] = []

  for (const file of files) {
    const isAllowed = ALLOWED_EVOLUTION_PREFIXES.some((prefix) => file.path.startsWith(prefix))
    if (!isAllowed) {
      reasons.push(`Blocked: "${file.path}" is outside allowed evolution paths`)
    }

    if (file.content.length > MAX_EVOLUTION_FILE_SIZE) {
      reasons.push(
        `Blocked: file "${file.path}" exceeds size limit (${file.content.length} > ${MAX_EVOLUTION_FILE_SIZE} bytes)`
      )
    }

    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(file.content)) {
        reasons.push(`Blocked: potential secret detected in "${file.path}"`)
      }
    }
  }

  return {
    verdict: reasons.length > 0 ? "blocked" : "approved",
    reasons,
    checkedAt: formatISO(new Date())
  }
}

/**
 * Validate that an emotional state has all values within [0, 1].
 */
export function validateEmotionalState(state: EmotionalState): GuardianResult {
  const reasons: string[] = []

  for (const [key, value] of Object.entries(state)) {
    if (typeof value !== "number" || value < 0 || value > 1) {
      reasons.push(`Emotional dimension "${key}" out of bounds: ${value}`)
    }
  }

  return {
    verdict: reasons.length > 0 ? "blocked" : "approved",
    reasons,
    checkedAt: formatISO(new Date())
  }
}
