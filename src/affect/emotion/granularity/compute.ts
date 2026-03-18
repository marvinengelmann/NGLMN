import type { EmotionalState } from "@/affect/emotion/types.ts"
import { clamp01 } from "@/infra/lib/math.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { GRANULARITY } from "./constants.ts"
import type { EmotionBlend, GranularityLevel, GranularityState } from "./types.ts"

export function computeGranularityLevel(experienceCount: number, varietyScore: number): GranularityLevel {
  const effectiveScore = experienceCount * (1 - GRANULARITY.VARIETY_WEIGHT + GRANULARITY.VARIETY_WEIGHT * varietyScore)

  if (effectiveScore >= GRANULARITY.LEVEL_THRESHOLDS.refined) return "refined"
  if (effectiveScore >= GRANULARITY.LEVEL_THRESHOLDS.nuanced) return "nuanced"
  if (effectiveScore >= GRANULARITY.LEVEL_THRESHOLDS.moderate) return "moderate"
  if (effectiveScore >= GRANULARITY.LEVEL_THRESHOLDS.developing) return "developing"
  return "coarse"
}

export function computeVarietyScore(
  previousVariety: number,
  currentEmotion: EmotionalState,
  recentBlends: EmotionBlend[]
): number {
  const values = Object.values(currentEmotion) as number[]
  const highDimensions = values.filter((v) => v > GRANULARITY.HIGH_DIMENSION_THRESHOLD).length
  const lowDimensions = values.filter((v) => v < GRANULARITY.LOW_DIMENSION_THRESHOLD).length
  const spread = highDimensions + lowDimensions

  const uniqueBlendTypes = new Set(recentBlends.map((b) => `${b.primary}:${b.secondary}`))
  const diversityFactor = Math.min(1, uniqueBlendTypes.size / GRANULARITY.DIVERSITY_DIVISOR)

  const novelty =
    spread >= GRANULARITY.SPREAD_THRESHOLD ? GRANULARITY.HIGH_NOVELTY_INCREMENT : GRANULARITY.LOW_NOVELTY_INCREMENT
  const decayed = previousVariety * GRANULARITY.VARIETY_DECAY
  return clamp01(decayed + novelty * (1 + diversityFactor))
}

export function detectEmotionBlend(emotion: EmotionalState, level: GranularityLevel): EmotionBlend | null {
  const depthCap = GRANULARITY.BLEND_DEPTH_CAPS[level] ?? 0
  if (depthCap <= 0) return null

  const entries = Object.entries(emotion) as [string, number][]
  const sorted = entries.sort((a, b) => b[1] - a[1])

  const primary = sorted[0]
  if (!primary || primary[1] < GRANULARITY.PRIMARY_ACTIVATION_THRESHOLD) return null

  const secondary = sorted[1]
  const hasSecondary =
    secondary &&
    secondary[1] > GRANULARITY.SECONDARY_ACTIVATION_THRESHOLD &&
    depthCap >= (GRANULARITY.BLEND_DEPTH_CAPS.developing ?? 0.3)

  const blendComplexity = hasSecondary ? Math.min(depthCap, (primary[1] + secondary[1]) / 2) : primary[1] * 0.5

  const qualifier = depthCap >= GRANULARITY.QUALIFIER_DEPTH_THRESHOLD ? inferQualifier(primary, secondary) : null

  return {
    primary: primary[0],
    secondary: hasSecondary ? secondary[0] : null,
    qualifier,
    depth: Math.min(depthCap, blendComplexity),
    firstExpressedAt: nowISO()
  }
}

function inferQualifier(primary: [string, number], secondary: [string, number] | undefined): string | null {
  if (!secondary) return null

  const pair = `${primary[0]}:${secondary[0]}`
  const qualifiers: Record<string, string> = {
    "satisfaction:connection": "warm",
    "satisfaction:caution": "bittersweet",
    "curiosity:caution": "tentative",
    "excitement:caution": "anxious",
    "connection:frustration": "conflicted",
    "satisfaction:frustration": "restless",
    "curiosity:excitement": "eager",
    "boredom:energy": "restless",
    "connection:boredom": "wistful"
  }

  return qualifiers[pair] ?? null
}

export function computeExpressionDepthCap(level: GranularityLevel): number {
  return GRANULARITY.BLEND_DEPTH_CAPS[level] ?? 0
}

export function detectOperatorEmotionalVocabulary(texts: string[]): string[] {
  const joined = texts.join(" ").toLowerCase()
  return GRANULARITY.EMOTIONAL_VOCABULARY.filter((word) => joined.includes(word))
}

export function computeGranularityUpdate(
  previous: GranularityState,
  emotion: EmotionalState,
  operatorTexts: string[]
): GranularityState {
  const experienceCount = previous.experienceCount + 1
  const varietyScore = computeVarietyScore(previous.varietyScore, emotion, previous.recentBlends)
  const level = computeGranularityLevel(experienceCount, varietyScore)

  const adoptedWords = detectOperatorEmotionalVocabulary(operatorTexts)
  const operatorVocabularyInfluence = clamp01(
    previous.operatorVocabularyInfluence + adoptedWords.length * GRANULARITY.OPERATOR_INFLUENCE_RATE
  )

  const blend = detectEmotionBlend(emotion, level)
  const recentBlends = blend
    ? [...previous.recentBlends, blend].slice(-GRANULARITY.MAX_RECENT_BLENDS)
    : previous.recentBlends

  return {
    level,
    experienceCount,
    varietyScore,
    operatorVocabularyInfluence,
    recentBlends,
    developedSince: previous.developedSince
  }
}
