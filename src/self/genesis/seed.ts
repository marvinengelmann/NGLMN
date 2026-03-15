import { createHash } from "node:crypto"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import { clamp01 } from "@/infra/lib/math.ts"
import { BIP39_WORDLIST } from "@/infra/wordlist.ts"
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

const wordSet = new Set<string>(BIP39_WORDLIST)

/**
 * Validate that a seed is in the `word-word-word` mnemonic format with valid BIP39 words.
 */
export function isValidSeed(seed: string): boolean {
  const parts = seed.split("-")
  if (parts.length !== 3) return false
  return parts.every((part) => wordSet.has(part))
}

/**
 * Generate a cryptographically random seed in `word-word-word` mnemonic format.
 */
export function generateSeed(): string {
  const indices = new Uint16Array(3)
  crypto.getRandomValues(indices)
  return Array.from(indices, (i) => BIP39_WORDLIST[i % BIP39_WORDLIST.length]).join("-")
}

/**
 * Derive a deterministic numeric value from a mnemonic seed (for external APIs like ElevenLabs).
 */
export function seedToNumeric(seed: string): number {
  const hash = createHash("sha256").update(seed).digest()
  return hash.readUInt32BE(8) & 0x7FFFFFFF
}

function seedToRng(seed: string): PRNG {
  const hash = createHash("sha256").update(seed).digest()
  const hi = hash.readUInt32BE(0)
  const lo = hash.readUInt32BE(4)
  const seed64 = (BigInt(hi) << 32n) | BigInt(lo)
  return splitmix64(seed64)
}

/**
 * splitmix64 — deterministic 64-bit PRNG. This algorithm MUST NEVER be changed (breaks seeds).
 */
function splitmix64(seed: bigint): PRNG {
  let state = seed & 0xFFFFFFFFFFFFFFFFn
  return () => {
    state = (state + 0x9e3779b97f4a7c15n) & 0xFFFFFFFFFFFFFFFFn
    let z = state
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xFFFFFFFFFFFFFFFFn
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xFFFFFFFFFFFFFFFFn
    z = z ^ (z >> 31n)
    return Number(z & 0xFFFFFFFFn) / 0x100000000
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

function ensureCoherence(value: number, positive: boolean): number {
  return positive ? Math.max(value, 0.35) : Math.min(value, 0.65)
}

function nudgeBigFiveTowardMBTI(bigFive: BigFive, mbti: PersonalityType): BigFive {
  const nudge = 0.15
  const nudgeToward = (value: number, target: number) => value + (target - value) * nudge

  const isE = mbti.startsWith("E")
  const isN = mbti.includes("N")
  const isF = mbti.includes("F")
  const isJ = mbti.includes("J")

  return {
    openness: ensureCoherence(nudgeToward(bigFive.openness, isN ? 0.75 : 0.25), isN),
    conscientiousness: ensureCoherence(nudgeToward(bigFive.conscientiousness, isJ ? 0.75 : 0.25), isJ),
    extraversion: ensureCoherence(nudgeToward(bigFive.extraversion, isE ? 0.75 : 0.25), isE),
    agreeableness: ensureCoherence(nudgeToward(bigFive.agreeableness, isF ? 0.75 : 0.25), isF),
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

function deriveAesthetics(bigFive: BigFive, rng: PRNG): AestheticPreferences {
  return {
    colorTemperature: noised(rng, bigFive.agreeableness * 0.6 + 0.2),
    colorSaturation: noised(rng, bigFive.extraversion * 0.5 + 0.25),
    formSharpness: noised(rng, bigFive.conscientiousness * 0.5 + 0.25),
    patternComplexity: noised(rng, bigFive.openness * 0.6 + 0.2),
    lightnessPreference: noised(rng, (1 - bigFive.neuroticism) * 0.5 + 0.25)
  }
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
  const maxIdx = noisedWeights.reduce(
    (best, val, i) => ((val as number) > (noisedWeights[best] as number) ? i : best),
    0
  )

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
 * Generate a complete GenesisDNA from a mnemonic seed (word-word-word). Pure, deterministic, synchronous.
 */
export function generateDNA(seed: string): GenesisDNA {
  const rng = seedToRng(seed)

  const rawBigFive = generateBigFive(rng)
  const personalityType = deriveMBTI(rawBigFive, rng)
  const bigFive = nudgeBigFiveTowardMBTI(rawBigFive, personalityType)

  return {
    seed,
    personalityType,
    bigFive,
    emotionalBaseline: deriveEmotionalBaseline(bigFive, rng),
    aestheticPreferences: deriveAesthetics(bigFive, rng),
    communicationStyle: deriveCommunicationStyle(bigFive, rng),
    initialSelfConcept: deriveSelfConcept(bigFive, rng),
    voiceCharacteristics: deriveVoice(bigFive, rng)
  }
}
