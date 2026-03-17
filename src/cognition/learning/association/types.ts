import * as z from "zod"

export const HebbianAssociation = z.object({
  id: z.string(),
  stimulusA: z.string(),
  stimulusB: z.string(),
  strength: z.number().min(0).max(1),
  coactivationCount: z.number().int().min(0),
  lastCoactivatedAt: z.string(),
  createdAt: z.string()
})
export type HebbianAssociation = z.infer<typeof HebbianAssociation>

export const AssociationActivation = z.object({
  stimulusA: z.string(),
  stimulusB: z.string(),
  activationStrength: z.number().min(0).max(1)
})
export type AssociationActivation = z.infer<typeof AssociationActivation>
