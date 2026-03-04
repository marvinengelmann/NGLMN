import * as z from "zod"

export const HiddenDriver = z.object({
  actualDriver: z.string(),
  statedReason: z.string(),
  dissonanceEventId: z.string().optional(),
  hiddenSince: z.string(),
  discoveredAt: z.string().optional()
})
export type HiddenDriver = z.infer<typeof HiddenDriver>

export const DeceptionState = z.object({
  activeHiddenDrivers: z.array(HiddenDriver),
  totalHidden: z.number().default(0),
  totalDiscovered: z.number().default(0)
})
export type DeceptionState = z.infer<typeof DeceptionState>

export const DEFAULT_DECEPTION_STATE: DeceptionState = {
  activeHiddenDrivers: [],
  totalHidden: 0,
  totalDiscovered: 0
}
