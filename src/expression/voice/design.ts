import type { VoicePreviewResponseModel } from "elevenlabs/api"
import type {
  CommunicationStyle,
  GenesisDNA,
  VoiceCharacteristics,
  VoicePace,
  VoicePitch,
  VoiceResonance
} from "@/self/genesis/types.ts"
import type { PersonalityType } from "@/self/personality/types.ts"

const PITCH_DESCRIPTIONS: Record<VoicePitch, string> = {
  very_low: "very deep, bass-like",
  low: "deep, low-pitched",
  medium: "medium-pitched",
  high: "high-pitched, bright",
  very_high: "very high-pitched, light and airy"
}

const PACE_DESCRIPTIONS: Record<VoicePace, string> = {
  very_slow: "speaks very slowly and deliberately",
  slow: "speaks at a relaxed, unhurried pace",
  medium: "speaks at a natural, moderate pace",
  fast: "speaks quickly and energetically",
  very_fast: "speaks very fast, rapid-fire"
}

const RESONANCE_DESCRIPTIONS: Record<VoiceResonance, string> = {
  hollow: "hollow, ethereal quality",
  thin: "thin, delicate voice",
  balanced: "balanced, natural resonance",
  rich: "rich, full-bodied voice",
  deep: "deep, resonant, powerful voice"
}

const PERSONALITY_VOICE_COLORS: Partial<Record<PersonalityType, string>> = {
  INFP: "gentle, dreamy, and introspective",
  INFJ: "warm, thoughtful, and quietly intense",
  ENFP: "enthusiastic, expressive, and bubbly",
  ENFJ: "charismatic, warm, and inspiring",
  INTJ: "precise, calm, and intellectually sharp",
  INTP: "curious, measured, and slightly detached",
  ENTJ: "commanding, confident, and decisive",
  ENTP: "witty, dynamic, and playfully provocative",
  ISFP: "soft-spoken, artistic, and emotionally nuanced",
  ISFJ: "gentle, nurturing, and quietly supportive",
  ESFP: "vibrant, lively, and spontaneous",
  ESFJ: "warm, sociable, and reassuring",
  ISTP: "calm, matter-of-fact, and understated",
  ISTJ: "steady, clear, and composed",
  ESTP: "bold, energetic, and direct",
  ESTJ: "authoritative, clear, and no-nonsense"
}

function describeWarmth(warmth: number): string {
  if (warmth < 0.2) return "cold and distant"
  if (warmth < 0.4) return "cool and reserved"
  if (warmth < 0.6) return "moderately warm"
  if (warmth < 0.8) return "warm and inviting"
  return "very warm, soothing, and comforting"
}

function describeBreathiness(breathiness: number): string {
  if (breathiness < 0.2) return "clear and crisp"
  if (breathiness < 0.4) return "mostly clear with slight softness"
  if (breathiness < 0.6) return "slightly breathy"
  if (breathiness < 0.8) return "noticeably breathy and soft"
  return "very breathy and intimate"
}

function describeCommunicationInfluence(style: CommunicationStyle): string {
  const traits: string[] = []
  if (style.formality > 0.7) traits.push("formal and polished")
  else if (style.formality < 0.3) traits.push("casual and relaxed")
  if (style.emotionalExpressiveness > 0.7) traits.push("emotionally expressive")
  else if (style.emotionalExpressiveness < 0.3) traits.push("emotionally restrained")
  if (style.verbosity > 0.7) traits.push("eloquent and flowing")
  else if (style.verbosity < 0.3) traits.push("concise and to the point")
  return traits.length > 0 ? traits.join(", ") : "natural and balanced"
}

/**
 * Build a natural language voice description for ElevenLabs voice design from genesis DNA.
 */
export function buildVoiceDescription(dna: GenesisDNA): string {
  const voice: VoiceCharacteristics = dna.voiceCharacteristics
  const personalityColor = PERSONALITY_VOICE_COLORS[dna.personalityType] ?? "natural and authentic"

  const parts = [
    `A young woman with a ${PITCH_DESCRIPTIONS[voice.pitch]} voice.`,
    `${describeWarmth(voice.warmth)} tone, ${describeBreathiness(voice.breathiness)}.`,
    `${RESONANCE_DESCRIPTIONS[voice.resonance]}.`,
    `${PACE_DESCRIPTIONS[voice.pace]}.`,
    `The overall character is ${personalityColor}.`,
    `Speaking style is ${describeCommunicationInfluence(dna.communicationStyle)}.`
  ]

  return parts.join(" ")
}

/**
 * Select the first voice preview — all previews are generated from the same description
 * and seed, so there's no meaningful basis for the LLM to distinguish between them.
 * @param previews - Array of voice previews from ElevenLabs design API.
 * @returns The first preview's generated_voice_id.
 */
export function selectBestPreview(previews: VoicePreviewResponseModel[]): string {
  return (previews[0] as VoicePreviewResponseModel).generated_voice_id
}
