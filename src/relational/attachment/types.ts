import * as z from "zod"

export const AttachmentStyle = z.object({
  secure: z.number().min(0).max(1),
  anxious: z.number().min(0).max(1),
  avoidant: z.number().min(0).max(1),
  disorganized: z.number().min(0).max(1)
})
export type AttachmentStyle = z.infer<typeof AttachmentStyle>

export const DEFAULT_ATTACHMENT: AttachmentStyle = {
  secure: 0.5,
  anxious: 0.25,
  avoidant: 0.15,
  disorganized: 0.1
}

export const AttachmentDynamics = z.object({
  separationDistress: z.number().min(0).max(1),
  reunionResponse: z.number().min(0).max(1),
  safeHavenSeeking: z.number().min(0).max(1),
  explorationBalance: z.number().min(0).max(1)
})
export type AttachmentDynamics = z.infer<typeof AttachmentDynamics>

export const RelationshipPhase = z.enum([
  "discovering",
  "honeymoon",
  "first_tensions",
  "deepening",
  "comfortable",
  "renewal"
])
export type RelationshipPhase = z.infer<typeof RelationshipPhase>

export const AttachmentSnapshot = z.object({
  style: AttachmentStyle,
  dynamics: AttachmentDynamics,
  timestamp: z.string()
})
export type AttachmentSnapshot = z.infer<typeof AttachmentSnapshot>

export const VulnerabilityState = z.object({
  level: z.number().min(0).max(1),
  windowOpen: z.boolean(),
  contributing: z.array(z.string()),
  timestamp: z.string()
})
export type VulnerabilityState = z.infer<typeof VulnerabilityState>

export const VulnerableMessageStyle = z.object({
  selfDisclosureDepth: z.number().min(0).max(1),
  hesitationLevel: z.number().min(0).max(1),
  intimacyReveal: z.number().min(0).max(1)
})
export type VulnerableMessageStyle = z.infer<typeof VulnerableMessageStyle>

export const DEFAULT_VULNERABLE_MESSAGE_STYLE: VulnerableMessageStyle = {
  selfDisclosureDepth: 0.2,
  hesitationLevel: 0.3,
  intimacyReveal: 0.1
}

export const IsolationStress = z.object({
  isolationCost: z.number().min(0).max(1),
  coregulationBenefit: z.number().min(0).max(1),
  allostasis: z.number().min(0).max(1),
  energyDrainRate: z.number().min(0).max(1),
  cortisolStressSignal: z.number().min(0).max(1)
})
export type IsolationStress = z.infer<typeof IsolationStress>

export const DEFAULT_ISOLATION_STRESS: IsolationStress = {
  isolationCost: 0,
  coregulationBenefit: 0,
  allostasis: 0.2,
  energyDrainRate: 0,
  cortisolStressSignal: 0
}

export const AttachmentCrisisState = z.object({
  active: z.boolean(),
  type: z.string().nullable(),
  multiplier: z.number(),
  expiresAt: z.string().nullable()
})
export type AttachmentCrisisState = z.infer<typeof AttachmentCrisisState>
