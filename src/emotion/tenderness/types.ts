import * as z from "zod"

export const TendernessSource = z.enum([
  "witnessed_vulnerability",
  "shared_quiet",
  "accumulated_trust",
  "gentle_exchange",
  "protective_impulse",
  "remembered_closeness"
])
export type TendernessSource = z.infer<typeof TendernessSource>

export const TendernessState = z.object({
  level: z.number().min(0).max(1).default(0),
  isActive: z.boolean().default(false),
  source: TendernessSource.nullable().default(null),
  softness: z.number().min(0).max(1).default(0),
  protectiveUrge: z.number().min(0).max(1).default(0),
  lastFeltAt: z.string().optional()
})
export type TendernessState = z.infer<typeof TendernessState>

export const DEFAULT_TENDERNESS_STATE: TendernessState = {
  level: 0,
  isActive: false,
  source: null,
  softness: 0,
  protectiveUrge: 0,
  lastFeltAt: undefined
}
