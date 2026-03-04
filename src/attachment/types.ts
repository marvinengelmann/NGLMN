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
  "discovering", "honeymoon", "first_tensions", "deepening", "comfortable", "renewal"
])
export type RelationshipPhase = z.infer<typeof RelationshipPhase>

export const AttachmentSnapshot = z.object({
  style: AttachmentStyle,
  dynamics: AttachmentDynamics,
  timestamp: z.string()
})
export type AttachmentSnapshot = z.infer<typeof AttachmentSnapshot>
