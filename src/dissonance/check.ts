import { differenceInHours } from "date-fns"

/**
 * Check whether active dissonance exceeds the significance threshold.
 */
export function isDissonanceSignificant(activeDissonance: number): boolean {
  return activeDissonance > 0.3
}
import type { EmotionalState } from "@/emotion/types.ts"
import { nowISO } from "@/lib/time.ts"
import type { SelfConcept } from "@/psyche/types.ts"
import type { DissonanceEvent, DissonanceResolution, DissonanceState } from "./types.ts"

interface SelfKnowledge {
  key: string
  value: unknown
}

const VALUE_PATTERNS: Array<{
  keywords: string[]
  check: (actions: string[], emotion: EmotionalState) => { matched: boolean; action: string; score: number }
}> = [
  {
    keywords: ["reflect", "introspect", "self-aware", "mindful"],
    check: (actions) => {
      const reflectCount = actions.filter((a) => a === "reflect").length
      if (reflectCount === 0 && actions.length >= 10) {
        return { matched: true, action: `no reflection in last ${actions.length} actions`, score: 0.4 }
      }
      return { matched: false, action: "", score: 0 }
    }
  },
  {
    keywords: ["calm", "patience", "peaceful", "serene"],
    check: (actions, emotion) => {
      if (emotion.frustration > 0.7 && actions.filter((a) => a !== "idle").length > 5) {
        return { matched: true, action: "high frustration with excessive activity", score: 0.5 }
      }
      return { matched: false, action: "", score: 0 }
    }
  },
  {
    keywords: ["honest", "truthful", "transparent", "sincere"],
    check: (_actions, emotion) => {
      if (emotion.caution > 0.7 && emotion.connection < 0.4) {
        return { matched: true, action: "high caution with low connection (guarded behavior)", score: 0.35 }
      }
      return { matched: false, action: "", score: 0 }
    }
  },
  {
    keywords: ["curious", "learn", "explore", "discover"],
    check: (actions, emotion) => {
      if (emotion.boredom > 0.6 && !actions.includes("evolve") && actions.length >= 8) {
        return { matched: true, action: "bored without exploration or evolution", score: 0.3 }
      }
      return { matched: false, action: "", score: 0 }
    }
  },
  {
    keywords: ["connect", "empathy", "relate", "bond"],
    check: (actions, emotion) => {
      if (emotion.connection < 0.3 && actions.filter((a) => a === "idle").length > 8) {
        return { matched: true, action: "low connection with prolonged inactivity", score: 0.35 }
      }
      return { matched: false, action: "", score: 0 }
    }
  },
  {
    keywords: ["courage", "brave", "bold", "fearless"],
    check: (_actions, emotion) => {
      if (emotion.caution > 0.8 && emotion.confidence < 0.3) {
        return { matched: true, action: "extreme caution with low confidence", score: 0.4 }
      }
      return { matched: false, action: "", score: 0 }
    }
  }
]

/**
 * Check for cognitive dissonance between declared values and recent actions — NO LLM call.
 */
export function checkDissonance(
  recentActions: string[],
  selfConcept: SelfConcept,
  emotion: EmotionalState,
  selfKnowledge: SelfKnowledge[]
): DissonanceEvent[] {
  const events: DissonanceEvent[] = []
  const now = nowISO()

  const declaredValues = selfKnowledge
    .filter((k) => typeof k.value === "string")
    .map((k) => ({ key: k.key, value: k.value as string }))

  for (const value of declaredValues) {
    const valueLower = value.value.toLowerCase()

    for (const pattern of VALUE_PATTERNS) {
      if (pattern.keywords.some((kw) => valueLower.includes(kw))) {
        const result = pattern.check(recentActions, emotion)
        if (result.matched) {
          events.push({
            declaredValue: `values "${value.value}"`,
            actualAction: result.action,
            dissonanceScore: result.score,
            timestamp: now
          })
          break
        }
      }
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

  if (emotion.frustration > 0.7 && !recentActions.includes("reflect") && recentActions.length >= 5) {
    events.push({
      declaredValue: "growth through reflection",
      actualAction: "high frustration without reflection",
      dissonanceScore: 0.35,
      timestamp: now
    })
  }

  return events
}

/**
 * Compute aggregate dissonance score from events with temporal decay.
 * Older events contribute less to the score.
 */
export function computeDissonanceScore(events: DissonanceEvent[]): number {
  if (events.length === 0) return 0
  const now = new Date()
  let total = 0
  let weightSum = 0

  for (const event of events) {
    const resolutionWeight = event.resolution && event.resolution !== "unresolved" ? 0.3 : 1.0
    const eventDate = new Date(event.timestamp)
    const hoursAgo = Number.isNaN(eventDate.getTime()) ? 0 : differenceInHours(now, eventDate)
    const temporalDecay = Math.pow(0.5, Math.max(0, hoursAgo) / 6)
    total += event.dissonanceScore * resolutionWeight * temporalDecay
    weightSum += temporalDecay
  }

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
