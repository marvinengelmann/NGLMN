import * as z from "zod"

export const GuardianVerdict = z.enum(["approved", "blocked", "warning"])
export type GuardianVerdict = z.infer<typeof GuardianVerdict>

export const GuardianResult = z.object({
  verdict: GuardianVerdict,
  reasons: z.array(z.string()),
  checkedAt: z.string()
})
export type GuardianResult = z.infer<typeof GuardianResult>

export const DriftSignalType = z.enum([
  "rapid_non_idle",
  "cost_spike",
  "repeated_triage",
  "duration_anomaly",
  "stuck_loop"
])
export type DriftSignalType = z.infer<typeof DriftSignalType>

export const DriftSeverity = z.enum(["low", "medium", "high"])
export type DriftSeverity = z.infer<typeof DriftSeverity>

export const DriftSignal = z.object({
  type: DriftSignalType,
  severity: DriftSeverity,
  detail: z.string(),
  detectedAt: z.string()
})
export type DriftSignal = z.infer<typeof DriftSignal>

export const DriftReport = z.object({
  signals: z.array(DriftSignal),
  healthy: z.boolean(),
  checkedAt: z.string()
})
export type DriftReport = z.infer<typeof DriftReport>

export const RollbackTier = z.enum(["soft", "hard"])
export type RollbackTier = z.infer<typeof RollbackTier>

export const RollbackResult = z.object({
  tier: RollbackTier,
  success: z.boolean(),
  actions: z.array(z.string()),
  errors: z.array(z.string()),
  timestamp: z.string()
})
export type RollbackResult = z.infer<typeof RollbackResult>
