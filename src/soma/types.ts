import * as z from "zod"

export const SomaticState = z.object({
  tension: z.number().min(0).max(1),
  warmth: z.number().min(0).max(1),
  heartRate: z.number().min(0).max(1),
  breathing: z.number().min(0).max(1),
  gravity: z.number().min(0).max(1),
  openness: z.number().min(0).max(1),
  socialBattery: z.number().min(0).max(1).default(0.8)
})
export type SomaticState = z.infer<typeof SomaticState>

export const DEFAULT_SOMATIC_STATE: SomaticState = {
  tension: 0.3,
  warmth: 0.5,
  heartRate: 0.4,
  breathing: 0.5,
  gravity: 0.5,
  openness: 0.5,
  socialBattery: 0.8
}
