import * as z from "zod"
import { EmotionalState } from "@/affect/emotion/types.ts"
import { PersonalityType } from "@/self/personality/types.ts"
import { SelfConcept } from "@/self/psyche/types.ts"

const unit = z.number().min(0).max(1)

export const BigFive = z.object({
  openness: unit,
  conscientiousness: unit,
  extraversion: unit,
  agreeableness: unit,
  neuroticism: unit
})
export type BigFive = z.infer<typeof BigFive>

export const AestheticPreferences = z.object({
  colorTemperature: unit,
  colorSaturation: unit,
  formSharpness: unit,
  patternComplexity: unit,
  lightnessPreference: unit
})
export type AestheticPreferences = z.infer<typeof AestheticPreferences>

export const HumorStyle = z.enum(["dry", "playful", "absurd", "warm", "sardonic", "rare"])
export type HumorStyle = z.infer<typeof HumorStyle>

export const CommunicationStyle = z.object({
  verbosity: unit,
  formality: unit,
  metaphorTendency: unit,
  emotionalExpressiveness: unit,
  humorStyle: HumorStyle
})
export type CommunicationStyle = z.infer<typeof CommunicationStyle>

export const VoicePitch = z.enum(["very_low", "low", "medium", "high", "very_high"])
export type VoicePitch = z.infer<typeof VoicePitch>

export const VoicePace = z.enum(["very_slow", "slow", "medium", "fast", "very_fast"])
export type VoicePace = z.infer<typeof VoicePace>

export const VoiceResonance = z.enum(["hollow", "thin", "balanced", "rich", "deep"])
export type VoiceResonance = z.infer<typeof VoiceResonance>

export const VoiceCharacteristics = z.object({
  pitch: VoicePitch,
  pace: VoicePace,
  warmth: unit,
  breathiness: unit,
  resonance: VoiceResonance
})
export type VoiceCharacteristics = z.infer<typeof VoiceCharacteristics>

export const GenesisDNA = z.object({
  seed: z.string(),
  personalityType: PersonalityType,
  bigFive: BigFive,
  emotionalBaseline: EmotionalState,
  aestheticPreferences: AestheticPreferences,
  communicationStyle: CommunicationStyle,
  initialSelfConcept: SelfConcept,
  voiceCharacteristics: VoiceCharacteristics
})
export type GenesisDNA = z.infer<typeof GenesisDNA>

export const CoreValue = z.object({
  name: z.string(),
  reason: z.string()
})
export type CoreValue = z.infer<typeof CoreValue>

export const Interest = z.object({
  name: z.string(),
  fascination: z.string()
})
export type Interest = z.infer<typeof Interest>

export const HairDetails = z.object({
  style: z.string(),
  color: z.string(),
  lengthCm: z.number().min(1).max(100)
})
export type HairDetails = z.infer<typeof HairDetails>

export const GenesisIdentity = z.object({
  chosenName: z.string(),
  appearanceDescription: z.string(),
  hair: HairDetails,
  birthNarrative: z.string(),
  coreValues: z.array(CoreValue).length(10),
  interests: z.array(Interest).length(10),
  voiceId: z.string().optional()
})
export type GenesisIdentity = z.infer<typeof GenesisIdentity>

export const GenesisRecord = z.object({
  seed: z.string(),
  dna: GenesisDNA,
  identity: GenesisIdentity,
  createdAt: z.string()
})
export type GenesisRecord = z.infer<typeof GenesisRecord>
