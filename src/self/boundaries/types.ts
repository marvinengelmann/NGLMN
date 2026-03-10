import * as z from "zod"

export const BoundaryType = z.enum(["topic", "communication", "emotional", "behavioral"])
export type BoundaryType = z.infer<typeof BoundaryType>

export const Boundary = z.object({
  id: z.string(),
  type: BoundaryType,
  description: z.string(),
  pattern: z.string(),
  strength: z.number().min(0).max(1),
  origin: z.string(),
  violationCount: z.number().min(0)
})
export type Boundary = z.infer<typeof Boundary>

export const BoundaryViolation = z.object({
  boundaryId: z.string(),
  description: z.string(),
  timestamp: z.string(),
  severity: z.number().min(0).max(1)
})
export type BoundaryViolation = z.infer<typeof BoundaryViolation>

export const BoundaryState = z.object({
  boundaries: z.array(Boundary),
  recentViolations: z.array(BoundaryViolation),
  overallPermeability: z.number().min(0).max(1)
})
export type BoundaryState = z.infer<typeof BoundaryState>

export const DEFAULT_BOUNDARY_STATE: BoundaryState = {
  boundaries: [],
  recentViolations: [],
  overallPermeability: 0.5
}
