import { clamp01 } from "@/infra/lib/math.ts"
import { nowISO } from "@/infra/lib/time.ts"
import type { RelationalPattern } from "@/relational/mind/types.ts"
import { RELATIONAL_PATTERN } from "./constants.ts"
import type { PatternActivationEvent, RelationalPatternState, RelationalTemplate } from "./types.ts"

interface PatternMatchContext {
  operatorMood: string
  messageText: string
  interactionTone: string
  recentPatterns: RelationalPattern[]
  timeOfDay: string
}

export function matchRelationalPattern(
  templates: RelationalTemplate[],
  context: PatternMatchContext
): { template: RelationalTemplate; confidence: number } | null {
  if (templates.length === 0) return null

  let bestMatch: { template: RelationalTemplate; confidence: number } | null = null

  for (const template of templates) {
    let confidence = 0
    const patternLower = template.pattern.toLowerCase()
    const contextLower = context.messageText.toLowerCase()

    if (patternLower.includes(context.operatorMood)) confidence += RELATIONAL_PATTERN.MATCH_MOOD_WEIGHT
    if (patternLower.includes(context.timeOfDay)) confidence += RELATIONAL_PATTERN.MATCH_TIME_WEIGHT

    const patternWords = patternLower.split(/\s+/)
    const contextWords = contextLower.split(/\s+/)
    const overlap = patternWords.filter((w) => contextWords.includes(w)).length
    confidence += Math.min(RELATIONAL_PATTERN.MATCH_OVERLAP_MAX, overlap * RELATIONAL_PATTERN.MATCH_OVERLAP_WEIGHT)

    const toneMatch = patternLower.includes(context.interactionTone.toLowerCase())
    if (toneMatch) confidence += RELATIONAL_PATTERN.MATCH_TONE_WEIGHT

    confidence *= template.strength

    for (const pattern of context.recentPatterns) {
      if (patternLower.includes(pattern.type)) {
        confidence += RELATIONAL_PATTERN.MATCH_PATTERN_WEIGHT
      }
    }

    confidence = clamp01(confidence)

    if (confidence >= RELATIONAL_PATTERN.MATCH_THRESHOLD && (!bestMatch || confidence > bestMatch.confidence)) {
      bestMatch = { template, confidence }
    }
  }

  return bestMatch
}

export function activatePattern(
  template: RelationalTemplate,
  confidence: number,
  awarenessLevel: number
): PatternActivationEvent {
  const awarenessDampening = 1 - awarenessLevel * RELATIONAL_PATTERN.AWARENESS_DAMPENING_SCALE
  const modulationScale = RELATIONAL_PATTERN.EMOTION_MODULATION_SCALE * awarenessDampening

  const emotionModulation: Record<string, number> = {}
  for (const [key, value] of Object.entries(template.associatedEmotion)) {
    emotionModulation[key] = value * confidence * modulationScale
  }

  return {
    templateId: template.id,
    triggerContext: `mood:${template.pattern}`,
    matchConfidence: confidence,
    emotionModulation,
    occurredAt: nowISO()
  }
}

export function computePatternModulation(event: PatternActivationEvent | null): Record<string, number> {
  if (!event) return {}
  return event.emotionModulation
}

export function updateTemplateStrength(
  templates: RelationalTemplate[],
  activatedId: string | null
): RelationalTemplate[] {
  return templates.map((t) => {
    if (t.id === activatedId) {
      return {
        ...t,
        strength: clamp01(t.strength + RELATIONAL_PATTERN.STRENGTH_INCREMENT),
        activationCount: t.activationCount + 1,
        lastActivatedAt: nowISO()
      }
    }
    return {
      ...t,
      strength: Math.max(RELATIONAL_PATTERN.TEMPLATE_MIN_STRENGTH, t.strength * RELATIONAL_PATTERN.STRENGTH_DECAY)
    }
  })
}

export function maybeFormTemplate(
  recentPatterns: RelationalPattern[],
  existingTemplates: RelationalTemplate[]
): RelationalTemplate | null {
  if (existingTemplates.length >= RELATIONAL_PATTERN.MAX_TEMPLATES) return null
  if (recentPatterns.length < RELATIONAL_PATTERN.MIN_PATTERN_OCCURRENCES) return null

  const patternCounts = new Map<string, { count: number; mood: string; patterns: RelationalPattern[] }>()
  for (const pattern of recentPatterns) {
    const key = `${pattern.type}:${pattern.associatedMood}`
    const existing = patternCounts.get(key)
    if (existing) {
      existing.count++
      existing.patterns.push(pattern)
    } else {
      patternCounts.set(key, { count: 1, mood: pattern.associatedMood, patterns: [pattern] })
    }
  }

  for (const [key, data] of patternCounts) {
    if (data.count < RELATIONAL_PATTERN.MIN_PATTERN_OCCURRENCES) continue

    const alreadyExists = existingTemplates.some((t) => t.pattern === key)
    if (alreadyExists) continue

    const emotionFromMood = moodToEmotionDeltas(data.mood)

    return {
      id: crypto.randomUUID(),
      pattern: key,
      associatedEmotion: emotionFromMood,
      formationContext: `Formed from ${data.count} occurrences of ${key}`,
      strength: RELATIONAL_PATTERN.TEMPLATE_INITIAL_STRENGTH,
      activationCount: 0,
      lastActivatedAt: null,
      formedAt: nowISO()
    }
  }

  return null
}

function moodToEmotionDeltas(mood: string): Record<string, number> {
  return RELATIONAL_PATTERN.MOOD_EMOTION_MAPPINGS[mood] ?? RELATIONAL_PATTERN.MOOD_DEFAULT_EMOTION
}

export function updatePatternAwareness(current: number, wasActivated: boolean, metacognitionLevel: number): number {
  if (!wasActivated) return current

  const increment =
    RELATIONAL_PATTERN.AWARENESS_LEARNING_RATE *
    (1 + metacognitionLevel * RELATIONAL_PATTERN.AWARENESS_METACOGNITION_BOOST)
  return Math.min(RELATIONAL_PATTERN.MAX_AWARENESS, current + increment)
}

export function decayActivePattern(state: RelationalPatternState): RelationalPatternState {
  if (!state.activePattern) return state

  const decayedModulation: Record<string, number> = {}
  let hasSignificant = false

  for (const [key, value] of Object.entries(state.activePattern.emotionModulation)) {
    const decayed = value * RELATIONAL_PATTERN.ACTIVATION_DECAY
    if (Math.abs(decayed) > RELATIONAL_PATTERN.ACTIVATION_SIGNIFICANCE_THRESHOLD) {
      decayedModulation[key] = decayed
      hasSignificant = true
    }
  }

  if (!hasSignificant) {
    return { ...state, activePattern: null }
  }

  return {
    ...state,
    activePattern: {
      ...state.activePattern,
      emotionModulation: decayedModulation
    }
  }
}
