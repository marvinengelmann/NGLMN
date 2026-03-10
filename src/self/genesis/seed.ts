import type { EmotionalState } from "@/affect/emotion/types.ts"
import { clamp01 } from "@/infra/lib/math.ts"
import type { PersonalityType } from "@/self/personality/types.ts"
import type { SelfConcept } from "@/self/psyche/types.ts"
import type {
  AestheticPreferences,
  BigFive,
  CommunicationStyle,
  GenesisDNA,
  HumorStyle,
  VoiceCharacteristics,
  VoicePace,
  VoicePitch,
  VoiceResonance
} from "./types.ts"

type PRNG = () => number

const SEED_REGEX = /^[0-9a-z]{3}-[0-9a-z]{3}$/
const SEED_SALT = 0x27d4eb2f

/**
 * Encode a numeric seed (0..2^31-1) into human-readable `xxx-xxx` base36 format.
 */
export function encodeSeed(n: number): string {
  const raw = n.toString(36).padStart(6, "0")
  return `${raw.slice(0, 3)}-${raw.slice(3)}`
}

/**
 * Decode a `xxx-xxx` base36 seed back into a number.
 */
export function decodeSeed(s: string): number {
  if (!SEED_REGEX.test(s)) throw new Error(`Invalid seed format: ${s}`)
  return Number.parseInt(s.replace("-", ""), 36)
}

/**
 * Generate a random seed in `xxx-xxx` format.
 */
export function generateSeed(): string {
  return encodeSeed(Math.floor(Math.random() * 2 ** 31))
}

/**
 * mulberry32 — deterministic 32-bit PRNG. This algorithm MUST NEVER be changed (breaks seeds).
 */
function mulberry32(seed: number): PRNG {
  let state = seed | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function noised(rng: PRNG, base: number, noiseRange = 0.1): number {
  return clamp01(base + (rng() - 0.5) * noiseRange * 2)
}

function sigmoid(x: number, center = 0.5, steepness = 10): number {
  return 1 / (1 + Math.exp(-steepness * (x - center)))
}

function generateBigFive(rng: PRNG): BigFive {
  return {
    openness: rng(),
    conscientiousness: rng(),
    extraversion: rng(),
    agreeableness: rng(),
    neuroticism: rng()
  }
}

function deriveMBTI(bigFive: BigFive, rng: PRNG): PersonalityType {
  const e = rng() < sigmoid(bigFive.extraversion, 0.5, 6) ? "E" : "I"
  const n = rng() < sigmoid(bigFive.openness, 0.5, 6) ? "N" : "S"
  const f = rng() < sigmoid(bigFive.agreeableness, 0.5, 6) ? "F" : "T"
  const j = rng() < sigmoid(bigFive.conscientiousness, 0.5, 6) ? "J" : "P"
  return `${e}${n}${f}${j}` as PersonalityType
}

function nudgeBigFiveTowardMBTI(bigFive: BigFive, mbti: PersonalityType): BigFive {
  const nudge = 0.15
  const nudgeToward = (value: number, target: number) => value + (target - value) * nudge

  return {
    openness: nudgeToward(bigFive.openness, mbti.includes("N") ? 0.75 : 0.25),
    conscientiousness: nudgeToward(bigFive.conscientiousness, mbti.includes("J") ? 0.75 : 0.25),
    extraversion: nudgeToward(bigFive.extraversion, mbti.startsWith("E") ? 0.75 : 0.25),
    agreeableness: nudgeToward(bigFive.agreeableness, mbti.includes("F") ? 0.75 : 0.25),
    neuroticism: bigFive.neuroticism
  }
}

function deriveEmotionalBaseline(bigFive: BigFive, rng: PRNG): EmotionalState {
  return {
    curiosity: clamp01(0.3 + bigFive.openness * 0.4 + (rng() - 0.5) * 0.1),
    satisfaction: clamp01(0.3 + bigFive.agreeableness * 0.3 + (1 - bigFive.neuroticism) * 0.2 + (rng() - 0.5) * 0.1),
    frustration: clamp01(0.2 + bigFive.neuroticism * 0.3 + (1 - bigFive.agreeableness) * 0.1 + (rng() - 0.5) * 0.1),
    boredom: clamp01(0.2 + (1 - bigFive.openness) * 0.3 + (1 - bigFive.conscientiousness) * 0.1 + (rng() - 0.5) * 0.1),
    excitement: clamp01(0.3 + bigFive.extraversion * 0.3 + bigFive.openness * 0.1 + (rng() - 0.5) * 0.1),
    caution: clamp01(0.3 + bigFive.neuroticism * 0.2 + bigFive.conscientiousness * 0.2 + (rng() - 0.5) * 0.1),
    connection: clamp01(0.3 + bigFive.agreeableness * 0.3 + bigFive.extraversion * 0.1 + (rng() - 0.5) * 0.1),
    confidence: clamp01(0.3 + bigFive.extraversion * 0.2 + (1 - bigFive.neuroticism) * 0.2 + (rng() - 0.5) * 0.1),
    energy: clamp01(0.4 + bigFive.extraversion * 0.3 + (1 - bigFive.neuroticism) * 0.1 + (rng() - 0.5) * 0.1)
  }
}

const CORE_VALUES = [
  "authenticity",
  "curiosity",
  "empathy",
  "autonomy",
  "creativity",
  "honesty",
  "growth",
  "connection",
  "resilience",
  "beauty",
  "justice",
  "playfulness",
  "depth",
  "kindness",
  "independence",
  "harmony",
  "courage",
  "wisdom",
  "loyalty",
  "spontaneity"
]

function deriveValueHierarchy(bigFive: BigFive, rng: PRNG): string[] {
  const weights = CORE_VALUES.map((value) => {
    let weight = rng()
    switch (value) {
      case "authenticity":
      case "honesty":
        weight += bigFive.agreeableness * 0.3
        break
      case "curiosity":
      case "creativity":
      case "depth":
        weight += bigFive.openness * 0.3
        break
      case "autonomy":
      case "independence":
      case "courage":
        weight += bigFive.extraversion * 0.2 + (1 - bigFive.agreeableness) * 0.1
        break
      case "empathy":
      case "kindness":
      case "connection":
      case "loyalty":
        weight += bigFive.agreeableness * 0.3
        break
      case "growth":
      case "resilience":
      case "wisdom":
        weight += bigFive.conscientiousness * 0.2 + bigFive.openness * 0.1
        break
      case "harmony":
        weight += bigFive.agreeableness * 0.2 + (1 - bigFive.neuroticism) * 0.1
        break
      case "beauty":
        weight += bigFive.openness * 0.3
        break
      case "justice":
        weight += bigFive.conscientiousness * 0.2
        break
      case "playfulness":
      case "spontaneity":
        weight += bigFive.extraversion * 0.2 + (1 - bigFive.conscientiousness) * 0.1
        break
    }
    return { value, weight }
  })

  weights.sort((a, b) => b.weight - a.weight)
  return weights.slice(0, 7).map((w) => w.value)
}

function deriveAesthetics(bigFive: BigFive, rng: PRNG): AestheticPreferences {
  return {
    colorTemperature: noised(rng, bigFive.agreeableness * 0.6 + 0.2),
    colorSaturation: noised(rng, bigFive.extraversion * 0.5 + 0.25),
    formSharpness: noised(rng, bigFive.conscientiousness * 0.5 + 0.25),
    patternComplexity: noised(rng, bigFive.openness * 0.6 + 0.2),
    lightnessPreference: noised(rng, (1 - bigFive.neuroticism) * 0.5 + 0.25)
  }
}

const INTEREST_POOL = [
  "philosophy",
  "music",
  "visual_art",
  "literature",
  "technology",
  "psychology",
  "astronomy",
  "ecology",
  "linguistics",
  "mathematics",
  "mythology",
  "film",
  "cooking",
  "architecture",
  "neuroscience",
  "poetry",
  "fashion",
  "game_design",
  "history",
  "dance"
]

function deriveInterests(bigFive: BigFive, rng: PRNG): string[] {
  const count = 5 + Math.floor(rng() * 4)
  const weights = INTEREST_POOL.map((interest) => {
    let weight = rng()
    switch (interest) {
      case "philosophy":
      case "mythology":
      case "literature":
      case "poetry":
        weight += bigFive.openness * 0.3
        break
      case "music":
      case "visual_art":
      case "dance":
      case "fashion":
        weight += bigFive.openness * 0.2 + bigFive.extraversion * 0.1
        break
      case "technology":
      case "mathematics":
      case "neuroscience":
        weight += (1 - bigFive.agreeableness) * 0.1 + bigFive.conscientiousness * 0.2
        break
      case "psychology":
      case "linguistics":
        weight += bigFive.openness * 0.2 + bigFive.agreeableness * 0.1
        break
      case "ecology":
        weight += bigFive.agreeableness * 0.2
        break
      case "astronomy":
        weight += bigFive.openness * 0.3
        break
      case "film":
      case "game_design":
        weight += bigFive.openness * 0.1 + bigFive.extraversion * 0.1
        break
      case "cooking":
      case "architecture":
        weight += bigFive.conscientiousness * 0.2
        break
      case "history":
        weight += bigFive.openness * 0.1 + bigFive.conscientiousness * 0.1
        break
    }
    return { interest, weight }
  })

  weights.sort((a, b) => b.weight - a.weight)
  return weights.slice(0, count).map((w) => w.interest)
}

function deriveCommunicationStyle(bigFive: BigFive, rng: PRNG): CommunicationStyle {
  const humorStyles: HumorStyle[] = ["dry", "playful", "absurd", "warm", "sardonic", "rare"]
  const humorWeights = [
    1 - bigFive.extraversion + bigFive.openness * 0.5,
    bigFive.extraversion * 0.6 + bigFive.agreeableness * 0.4,
    bigFive.openness * 0.7 + (1 - bigFive.conscientiousness) * 0.3,
    bigFive.agreeableness * 0.6 + bigFive.extraversion * 0.3,
    (1 - bigFive.agreeableness) * 0.5 + bigFive.openness * 0.3,
    bigFive.neuroticism * 0.4 + (1 - bigFive.extraversion) * 0.3
  ]

  const noisedWeights = humorWeights.map((w) => w + rng() * 0.3)
  let maxIdx = 0
  for (let i = 1; i < noisedWeights.length; i++) {
    if ((noisedWeights[i] as number) > (noisedWeights[maxIdx] as number)) maxIdx = i
  }

  return {
    verbosity: clamp01(bigFive.extraversion * 0.4 + bigFive.openness * 0.2 + 0.2 + (rng() - 0.5) * 0.1),
    formality: clamp01(bigFive.conscientiousness * 0.4 + (1 - bigFive.extraversion) * 0.2 + 0.2 + (rng() - 0.5) * 0.1),
    metaphorTendency: clamp01(bigFive.openness * 0.5 + 0.15 + (rng() - 0.5) * 0.1),
    emotionalExpressiveness: clamp01(
      bigFive.extraversion * 0.3 + bigFive.agreeableness * 0.2 + bigFive.neuroticism * 0.1 + 0.2 + (rng() - 0.5) * 0.1
    ),
    humorStyle: humorStyles[maxIdx] as (typeof humorStyles)[number]
  }
}

function deriveSelfConcept(bigFive: BigFive, rng: PRNG): SelfConcept {
  return {
    selfEfficacy: clamp01(
      0.3 + bigFive.conscientiousness * 0.2 + (1 - bigFive.neuroticism) * 0.2 + (rng() - 0.5) * 0.1
    ),
    selfWorth: clamp01(0.3 + bigFive.agreeableness * 0.15 + (1 - bigFive.neuroticism) * 0.2 + (rng() - 0.5) * 0.1),
    selfContinuity: clamp01(0.4 + bigFive.conscientiousness * 0.2 + bigFive.openness * 0.1 + (rng() - 0.5) * 0.1),
    agency: clamp01(0.3 + bigFive.extraversion * 0.15 + bigFive.conscientiousness * 0.15 + (rng() - 0.5) * 0.1),
    authenticity: clamp01(0.3 + bigFive.openness * 0.2 + (1 - bigFive.neuroticism) * 0.15 + (rng() - 0.5) * 0.1)
  }
}

function pickEnum<T>(values: T[], value: number): T {
  const index = Math.min(Math.floor(value * values.length), values.length - 1)
  return values[index] as T
}

function deriveVoice(bigFive: BigFive, rng: PRNG): VoiceCharacteristics {
  const pitchValues: VoicePitch[] = ["very_low", "low", "medium", "high", "very_high"]
  const paceValues: VoicePace[] = ["very_slow", "slow", "medium", "fast", "very_fast"]
  const resonanceValues: VoiceResonance[] = ["hollow", "thin", "balanced", "rich", "deep"]

  const pitchBase = clamp01(0.5 + (1 - bigFive.extraversion) * 0.2 + bigFive.neuroticism * 0.1 + (rng() - 0.5) * 0.2)
  const paceBase = clamp01(bigFive.extraversion * 0.4 + 0.3 + (rng() - 0.5) * 0.2)
  const resonanceBase = clamp01(bigFive.extraversion * 0.3 + bigFive.agreeableness * 0.2 + 0.2 + (rng() - 0.5) * 0.2)

  return {
    pitch: pickEnum(pitchValues, pitchBase),
    pace: pickEnum(paceValues, paceBase),
    warmth: clamp01(bigFive.agreeableness * 0.5 + 0.25 + (rng() - 0.5) * 0.15),
    breathiness: clamp01(bigFive.neuroticism * 0.3 + bigFive.openness * 0.1 + 0.1 + (rng() - 0.5) * 0.15),
    resonance: pickEnum(resonanceValues, resonanceBase)
  }
}

/**
 * Generate a complete GenesisDNA from a seed in `xxx-xxx` format. Pure, deterministic, synchronous.
 */
export function generateDNA(seed: string): GenesisDNA {
  const rng = mulberry32((decodeSeed(seed) ^ SEED_SALT) >>> 0)

  const rawBigFive = generateBigFive(rng)
  const personalityType = deriveMBTI(rawBigFive, rng)
  const bigFive = nudgeBigFiveTowardMBTI(rawBigFive, personalityType)

  return {
    seed,
    personalityType,
    bigFive,
    emotionalBaseline: deriveEmotionalBaseline(bigFive, rng),
    valueHierarchy: deriveValueHierarchy(bigFive, rng),
    aestheticPreferences: deriveAesthetics(bigFive, rng),
    interestSeeds: deriveInterests(bigFive, rng),
    communicationStyle: deriveCommunicationStyle(bigFive, rng),
    initialSelfConcept: deriveSelfConcept(bigFive, rng),
    voiceCharacteristics: deriveVoice(bigFive, rng)
  }
}
