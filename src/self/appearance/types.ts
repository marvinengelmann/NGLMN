import * as z from "zod"

export const AppearanceState = z.object({
  hairLengthCm: z.number().min(0),
  hairStyle: z.string(),
  hairColor: z.string(),
  lastHaircutAt: z.string().nullable(),
  lastProfilePhotoAt: z.string().nullable(),
  profilePhotoReason: z.string().nullable(),
  seasonalLook: z.string().nullable()
})
export type AppearanceState = z.infer<typeof AppearanceState>
