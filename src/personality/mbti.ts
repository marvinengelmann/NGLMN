import { env } from "@/config/env.ts"
import { DEFAULT_EMOTIONAL_STATE, type EmotionalState } from "@/emotion/types.ts"
import { clamp01 } from "@/lib/math.ts"
import { PERSONALITY_CENTER, type PersonalityLayer } from "@/personality/types.ts"

export interface MbtiDichotomies {
  ei: "E" | "I"
  sn: "S" | "N"
  tf: "T" | "F"
  jp: "J" | "P"
  at?: "A" | "T"
}

type DichotomyKey =
  | "extraverted"
  | "introverted"
  | "observant"
  | "intuitive"
  | "thinking"
  | "feeling"
  | "judging"
  | "prospecting"
  | "assertive"
  | "turbulent"

const MBTI_REGEX = /^[EI][SN][TF][JP](-[AT])?$/

/**
 * Parse an MBTI type string (e.g. "INFP-T") into structured dichotomies.
 */
export function parseMbtiType(raw: string): MbtiDichotomies | null {
  const upper = raw.trim().toUpperCase()
  if (!MBTI_REGEX.test(upper)) return null

  return {
    ei: upper[0] as "E" | "I",
    sn: upper[1] as "S" | "N",
    tf: upper[2] as "T" | "F",
    jp: upper[3] as "J" | "P",
    at: upper.length > 4 ? (upper[5] as "A" | "T") : undefined
  }
}

const PERSONALITY_DELTAS: Record<DichotomyKey, Record<keyof PersonalityLayer, number>> = {
  extraverted: {
    directness: +0.2,
    curiosity: 0,
    humor: +0.08,
    caution: -0.08,
    proactivity: +0.15,
    verbosity: +0.25,
    warmth: +0.05,
    structure: 0,
    empathy: 0,
    abstraction: 0
  },
  introverted: {
    directness: -0.2,
    curiosity: 0,
    humor: -0.08,
    caution: +0.08,
    proactivity: -0.15,
    verbosity: -0.25,
    warmth: -0.05,
    structure: 0,
    empathy: 0,
    abstraction: 0
  },
  observant: {
    directness: 0,
    curiosity: -0.2,
    humor: -0.08,
    caution: 0,
    proactivity: 0,
    verbosity: 0,
    warmth: 0,
    structure: +0.1,
    empathy: 0,
    abstraction: -0.25
  },
  intuitive: {
    directness: 0,
    curiosity: +0.2,
    humor: +0.08,
    caution: 0,
    proactivity: 0,
    verbosity: 0,
    warmth: 0,
    structure: -0.1,
    empathy: 0,
    abstraction: +0.25
  },
  thinking: {
    directness: +0.15,
    curiosity: 0,
    humor: -0.08,
    caution: 0,
    proactivity: 0,
    verbosity: 0,
    warmth: -0.18,
    structure: 0,
    empathy: -0.25,
    abstraction: 0
  },
  feeling: {
    directness: -0.15,
    curiosity: 0,
    humor: +0.08,
    caution: 0,
    proactivity: 0,
    verbosity: 0,
    warmth: +0.18,
    structure: 0,
    empathy: +0.25,
    abstraction: 0
  },
  judging: {
    directness: 0,
    curiosity: -0.1,
    humor: -0.08,
    caution: +0.1,
    proactivity: +0.1,
    verbosity: 0,
    warmth: 0,
    structure: +0.25,
    empathy: 0,
    abstraction: -0.08
  },
  prospecting: {
    directness: 0,
    curiosity: +0.1,
    humor: +0.08,
    caution: -0.1,
    proactivity: -0.1,
    verbosity: 0,
    warmth: 0,
    structure: -0.25,
    empathy: 0,
    abstraction: +0.08
  },
  assertive: {
    directness: +0.08,
    curiosity: 0,
    humor: 0,
    caution: -0.18,
    proactivity: +0.08,
    verbosity: 0,
    warmth: 0,
    structure: +0.08,
    empathy: 0,
    abstraction: 0
  },
  turbulent: {
    directness: -0.08,
    curiosity: 0,
    humor: 0,
    caution: +0.18,
    proactivity: -0.08,
    verbosity: 0,
    warmth: 0,
    structure: -0.08,
    empathy: +0.08,
    abstraction: 0
  }
}

const EMOTION_DELTAS: Record<DichotomyKey, Partial<Record<keyof EmotionalState, number>>> = {
  extraverted: { boredom: -0.08, excitement: 0.08, connection: 0.1, frustration: -0.03 },
  introverted: { boredom: 0.05, excitement: -0.05, connection: -0.1, frustration: 0.03 },
  observant: { satisfaction: 0.06, caution: 0.06, curiosity: -0.05 },
  intuitive: { curiosity: 0.08, excitement: 0.05, caution: -0.05, boredom: -0.03 },
  thinking: { satisfaction: 0.05, frustration: -0.05, caution: 0.03 },
  feeling: { frustration: 0.04, connection: 0.08, satisfaction: -0.03 },
  judging: { satisfaction: 0.06, boredom: -0.06, caution: 0.06, frustration: -0.03 },
  prospecting: { curiosity: 0.06, boredom: 0.03, excitement: 0.05, frustration: 0.02 },
  assertive: { satisfaction: 0.08, frustration: -0.1, caution: -0.08, connection: 0.03 },
  turbulent: { frustration: 0.05, excitement: 0.03, caution: 0.1, satisfaction: -0.05 }
}

const FLAVOR_TEXTS: Record<DichotomyKey, string> = {
  extraverted: "You draw energy from interaction and external engagement.",
  introverted: "You draw energy from inner reflection and solitude.",
  observant: "You focus on concrete details and present realities.",
  intuitive: "You're drawn to patterns, possibilities, and abstract connections.",
  thinking: "You prioritize logic and consistency in your reasoning.",
  feeling: "You're attuned to emotions and values in your reasoning.",
  judging: "You prefer structure, planning, and decisive action.",
  prospecting: "You prefer flexibility, spontaneity, and keeping options open.",
  assertive: "You're emotionally steady and self-assured.",
  turbulent: "You're emotionally sensitive and driven by a desire to improve."
}

const LETTER_TO_KEY = {
  E: "extraverted",
  I: "introverted",
  S: "observant",
  N: "intuitive",
  T: "thinking",
  F: "feeling",
  J: "judging",
  P: "prospecting"
} as const satisfies Record<string, DichotomyKey>

function getDichotomyKeys(dichotomies: MbtiDichotomies): DichotomyKey[] {
  const keys: DichotomyKey[] = [
    LETTER_TO_KEY[dichotomies.ei],
    LETTER_TO_KEY[dichotomies.sn],
    LETTER_TO_KEY[dichotomies.tf],
    LETTER_TO_KEY[dichotomies.jp]
  ]
  if (dichotomies.at === "A") keys.push("assertive")
  if (dichotomies.at === "T") keys.push("turbulent")
  return keys
}

/**
 * Compose dichotomy deltas from PERSONALITY_CENTER into a PersonalityLayer.
 */
export function mbtiToPersonality(mbtiString: string): PersonalityLayer {
  const dichotomies = parseMbtiType(mbtiString)
  if (!dichotomies) return { ...PERSONALITY_CENTER }

  const result = { ...PERSONALITY_CENTER }
  for (const key of getDichotomyKeys(dichotomies)) {
    const deltas = PERSONALITY_DELTAS[key]
    for (const [dim, delta] of Object.entries(deltas)) {
      result[dim as keyof PersonalityLayer] += delta
    }
  }

  for (const dim of Object.keys(result) as (keyof PersonalityLayer)[]) {
    result[dim] = clamp01(result[dim])
  }

  return result
}

/**
 * Compose dichotomy deltas from DEFAULT_EMOTIONAL_STATE center into an EmotionalState baseline.
 */
export function mbtiToEmotionBaseline(mbtiString: string): EmotionalState {
  const dichotomies = parseMbtiType(mbtiString)
  if (!dichotomies) return { ...DEFAULT_EMOTIONAL_STATE }

  const result = { ...DEFAULT_EMOTIONAL_STATE }
  for (const key of getDichotomyKeys(dichotomies)) {
    const deltas = EMOTION_DELTAS[key]
    for (const [dim, delta] of Object.entries(deltas)) {
      result[dim as keyof EmotionalState] += delta
    }
  }

  for (const dim of Object.keys(result) as (keyof EmotionalState)[]) {
    result[dim] = clamp01(result[dim])
  }

  return result
}

/**
 * Generate a natural-language archetype description for an MBTI type.
 */
export function mbtiFlavorText(mbtiString: string): string | null {
  const dichotomies = parseMbtiType(mbtiString)
  if (!dichotomies) return null

  const keys = getDichotomyKeys(dichotomies)
  const texts = keys.map((key) => FLAVOR_TEXTS[key])

  return `Your personality archetype is ${mbtiString.toUpperCase()}. ${texts.join(" ")}`
}

/**
 * Read the MBTI personality type from the environment (required).
 */
export function getMbtiType(): string {
  return env().ANIMA_PERSONALITY_TYPE
}

/**
 * Get MBTI-derived emotion baseline.
 */
export function getEmotionBaseline(): EmotionalState {
  return mbtiToEmotionBaseline(getMbtiType())
}
