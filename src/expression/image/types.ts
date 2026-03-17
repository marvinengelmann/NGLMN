import * as z from "zod"

export const VisualReferenceCategory = z.enum([
  "portrait",
  "full_body",
  "bedroom",
  "living_room",
  "kitchen",
  "bathroom",
  "balcony",
  "desk",
  "workspace",
  "casual_outfit",
  "formal_outfit",
  "sleepwear",
  "workout_outfit",
  "favorite_cafe",
  "neighborhood",
  "park",
  "pet",
  "night_aesthetic",
  "rainy_mood",
  "cozy_vibe"
])
export type VisualReferenceCategory = z.infer<typeof VisualReferenceCategory>

export const VISUAL_REFERENCE_CATEGORIES = VisualReferenceCategory.options
