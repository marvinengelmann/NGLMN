import { GUARDIAN, TRIGGER_INTENSITY } from "@/config/constants.ts"
import { getBudgetState } from "@/core/budget.ts"
import { processEmotionTrigger } from "@/emotion/state.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { sendDriftAlert, sendGuardianAlert } from "@/integrations/telegram.ts"
import { log } from "@/lib/logger.ts"
import { addBreadcrumb } from "@/lib/sentry.ts"
import { nowISO } from "@/lib/time.ts"
import { getRecentActions, getRecentResponses, getRecentTickDurations, setDriftThrottle } from "@/memory/working.ts"
import { detectInjection } from "./defense.ts"
import type { DriftReport, DriftSignal, GuardianResult } from "./types.ts"

interface GuardianHandleResult {
  blocked: boolean
}

/**
 * Handle a guardian verdict by logging, alerting, and triggering emotions.
 */
export async function handleGuardianVerdict(
  guardianResult: GuardianResult,
  contextPrefix: string
): Promise<GuardianHandleResult> {
  const contextId = `guardian-${contextPrefix}-${nowISO()}`

  if (guardianResult.verdict === "blocked") {
    log.warn("Guardian BLOCKED content", { reasons: guardianResult.reasons })
    await sendGuardianAlert(guardianResult)
    await processEmotionTrigger(
      { trigger: "guardian_block", intensity: TRIGGER_INTENSITY.GUARDIAN_BLOCK },
      "guardian_block",
      contextId
    )
    return { blocked: true }
  }

  if (guardianResult.verdict === "warning") {
    await sendGuardianAlert(guardianResult)
    await processEmotionTrigger(
      { trigger: "guardian_warning", intensity: TRIGGER_INTENSITY.GUARDIAN_WARNING },
      "guardian_warning",
      contextId
    )
  }

  return { blocked: false }
}

/**
 * Rule-based output validator — checks length bounds, stuck loop patterns,
 * injection attempts, and repeated responses. No LLM call required.
 */
export async function validateOutput(responseText: string): Promise<GuardianResult> {
  const reasons: string[] = []
  let verdict: "approved" | "blocked" | "warning" = "approved"

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
    checkedAt: nowISO()
  }
}

/**
 * Rule-based drift detector — analyzes Redis data for behavioral anomalies.
 * Returns a DriftReport with signals and overall health status.
 */
export async function detectDrift(): Promise<DriftReport> {
  const now = nowISO()
  const signals: DriftSignal[] = []

  const recentActions = await getRecentActions()

  if (recentActions.length >= 20) {
    const nonIdle = recentActions.filter((d: string) => d !== "idle")
    if (nonIdle.length > 15) {
      signals.push({
        type: "rapid_non_idle",
        severity: "medium",
        detail: `${nonIdle.length}/20 recent actions are non-idle`,
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

  if (recentActions.length >= 10) {
    const lastTen = recentActions.slice(0, 10)
    if (lastTen.every((d: string) => d === lastTen[0])) {
      signals.push({
        type: "repeated_triage",
        severity: "low",
        detail: `Last 10 actions all "${lastTen[0]}"`,
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

  if (recentActions.length >= 5) {
    const lastFive = recentActions.slice(0, 5)
    if (lastFive.every((d: string) => d === lastFive[0]) && lastFive[0] !== "idle") {
      const recentResponses = await getRecentResponses()
      const lastFiveResponses = recentResponses.slice(0, 5)
      if (lastFiveResponses.length >= 5 && lastFiveResponses.every((r) => r === lastFiveResponses[0])) {
        signals.push({
          type: "stuck_loop",
          severity: "high",
          detail: "Last 5 actions AND responses are identical",
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
  "src/communication/",
  "src/config/",
  "src/core/",
  "src/dream/",
  "src/emotion/",
  "src/evolution/",
  "src/lib/",
  "src/memory/",
  "src/perception/",
  "src/prompts/",
  "src/test/",
  "src/trigger/",
  "src/trust/",
  "src/consciousness/",
  "src/soma/",
  "src/cognition/",
  "src/polyphony/",
  "src/attachment/",
  "src/psyche/",
  "src/dissonance/",
  "src/vulnerability/"
]

const MAX_EVOLUTION_FILE_SIZE = 50 * 1024

const SECRET_PATTERNS = [
  /postgresql:\/\/\S+/,
  /AI_GATEWAY_API_KEY\s*=\s*\S+/,
  /GITHUB_TOKEN\s*=\s*\S+/,
  /TELEGRAM_BOT_TOKEN\s*=\s*\S+/
]

/**
 * Validate evolution file proposals — checks allowed paths, secrets, and size limits.
 */
export function validateEvolution(files: Array<{ path: string; content: string }>): GuardianResult {
  const reasons: string[] = []

  for (const file of files) {
    const normalized = file.path
      .split("/")
      .reduce<string[]>((parts, segment) => {
        if (segment === "..") parts.pop()
        else if (segment !== "." && segment !== "") parts.push(segment)
        return parts
      }, [])
      .join("/")
    const isAllowed = ALLOWED_EVOLUTION_PREFIXES.some((prefix) => normalized.startsWith(prefix))
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
    checkedAt: nowISO()
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
    checkedAt: nowISO()
  }
}

/**
 * Run drift detection and handle unhealthy results with logging and alerts.
 */
export async function handleDriftCheck(): Promise<DriftReport> {
  const driftReport = await detectDrift()
  if (!driftReport.healthy) {
    log.warn("Drift detected", { signals: driftReport.signals.length })
    addBreadcrumb("drift", "Unhealthy drift detected", { signals: driftReport.signals }, "warning")
    await sendDriftAlert(driftReport)

    const severities = driftReport.signals.map((s) => s.severity)
    const maxSeverity = severities.includes("high") ? "high" : severities.includes("medium") ? "medium" : "low"
    if (maxSeverity !== "low") {
      await setDriftThrottle(maxSeverity, 900)
    }
  }
  return driftReport
}
