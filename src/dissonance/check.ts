import { differenceInHours } from "date-fns"
import { callIntelligence } from "@/core/intelligence.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import { log } from "@/lib/logger.ts"
import { nowISO } from "@/lib/time.ts"
import { VALUE_ACTION_PROMPT } from "@/prompts/dissonance.ts"
import type { SelfConcept } from "@/psyche/types.ts"
import type { DissonanceEvent, DissonanceResolution, DissonanceState } from "./types.ts"
import { ValueActionAnalysis } from "./types.ts"

/**
 * Check whether active dissonance exceeds the significance threshold.
 */
export function isDissonanceSignificant(activeDissonance: number): boolean {
  return activeDissonance > 0.3
}

interface SelfKnowledge {
  key: string
  value: unknown
}

/**
 * Check for cognitive dissonance between declared values and recent actions via LLM analysis.
 */
export async function checkDissonance(
  recentActions: string[],
  selfConcept: SelfConcept,
  emotion: EmotionalState,
  selfKnowledge: SelfKnowledge[]
): Promise<DissonanceEvent[]> {
  const events: DissonanceEvent[] = []
  const now = nowISO()

  const declaredValues = selfKnowledge
    .filter((k) => typeof k.value === "string")
    .map((k) => ({ key: k.key, value: k.value as string }))

  if (declaredValues.length > 0) {
    const emotionSummary = Object.entries(emotion)
      .filter(([, val]) => Math.abs((val as number) - 0.5) > 0.15)
      .map(([dim, val]) => `${dim}: ${(val as number).toFixed(2)}`)
      .join(", ")

    const userMessage = [
      "Declared values:",
      ...declaredValues.map((v) => `  - ${v.key}: ${v.value}`),
      `\nRecent actions (last ${recentActions.length}): ${recentActions.join(", ")}`,
      `\nEmotional state: ${emotionSummary}`
    ].join("\n")

    const result = await callIntelligence({
      system: VALUE_ACTION_PROMPT,
      userMessage,
      schema: ValueActionAnalysis,
      maxTokens: 512
    })

    if (result.isOk()) {
      result.value.mismatches.forEach((m) => {
        events.push({
          declaredValue: m.declaredValue,
          actualAction: m.actualAction,
          dissonanceScore: m.dissonanceScore,
          timestamp: now
        })
      })
    } else {
      log.warn("Value-action analysis LLM failed", { error: result.error.message })
    }
  }

  if (selfConcept.authenticity > 0.7 && emotion.frustration > 0.6 && emotion.connection < 0.3) {
    events.push({
      declaredValue: "high authenticity self-concept",
      actualAction: "frustrated and disconnected",
      dissonanceScore: 0.3,
      timestamp: now
    })
  }

  if (selfConcept.agency > 0.7 && recentActions.length >= 10 && recentActions.every((a) => a === "idle")) {
    events.push({
      declaredValue: "high agency self-concept",
      actualAction: "prolonged passivity despite high agency",
      dissonanceScore: 0.35,
      timestamp: now
    })
  }

  return events
}

/**
 * Compute aggregate dissonance score from events with temporal decay.
 */
export function computeDissonanceScore(events: DissonanceEvent[]): number {
  if (events.length === 0) return 0
  const now = new Date()

  const { total, weightSum } = events.reduce(
    (acc, event) => {
      const resolutionWeight = event.resolution && event.resolution !== "unresolved" ? 0.3 : 1.0
      const eventDate = new Date(event.timestamp)
      const hoursAgo = Number.isNaN(eventDate.getTime()) ? 0 : differenceInHours(now, eventDate)
      const temporalDecay = Math.pow(0.5, Math.max(0, hoursAgo) / 6)
      return {
        total: acc.total + event.dissonanceScore * resolutionWeight * temporalDecay,
        weightSum: acc.weightSum + temporalDecay
      }
    },
    { total: 0, weightSum: 0 }
  )

  return Math.min(1, total / Math.max(0.1, weightSum))
}

/**
 * Determine resolution strategy based on emotional profile and event context.
 */
export function resolveDissonance(event: DissonanceEvent, emotion: EmotionalState): DissonanceResolution {
  if (event.dissonanceScore > 0.45 && emotion.confidence > 0.6 && emotion.caution < 0.4) {
    return "attitude_change"
  }
  if (event.dissonanceScore > 0.3 && emotion.caution > 0.6 && emotion.confidence < 0.4) {
    return "behavior_change"
  }
  if (emotion.curiosity > 0.6) return "new_cognition"
  if (event.dissonanceScore < 0.3 || emotion.energy < 0.3) return "acceptance"
  return "acceptance"
}

/**
 * Build a full dissonance state from events.
 */
export function buildDissonanceState(events: DissonanceEvent[]): DissonanceState {
  const activeDissonance = computeDissonanceScore(events)
  const unresolvedEvents = events.filter((e) => !e.resolution || e.resolution === "unresolved")
  const cumulativeUnresolved = computeDissonanceScore(unresolvedEvents)
  return {
    activeDissonance,
    recentEvents: events.slice(0, 10),
    cumulativeUnresolved
  }
}
