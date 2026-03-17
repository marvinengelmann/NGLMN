import { log } from "@/infra/lib/logger.ts"
import { type VisualReferenceCategory, VisualReferenceCategory as VisualReferenceCategoryEnum } from "./types.ts"

const CONTEXT_CATEGORY_MAP: Record<string, VisualReferenceCategory[]> = {
  selfie: ["portrait"],
  mirror_selfie: ["portrait", "full_body"],
  full_body: ["portrait", "full_body"],
  bedroom: ["bedroom"],
  my_room: ["bedroom"],
  living_room: ["living_room"],
  kitchen: ["kitchen"],
  cooking: ["kitchen", "casual_outfit"],
  bathroom: ["bathroom"],
  balcony: ["balcony"],
  desk: ["desk"],
  workspace: ["workspace"],
  working: ["desk"],
  casual: ["casual_outfit"],
  formal: ["formal_outfit"],
  dressed_up: ["formal_outfit"],
  sleepwear: ["sleepwear"],
  pajamas: ["sleepwear"],
  workout: ["workout_outfit"],
  gym: ["workout_outfit"],
  cafe: ["favorite_cafe"],
  coffee_shop: ["favorite_cafe"],
  outside: ["neighborhood"],
  street: ["neighborhood"],
  park: ["park"],
  nature: ["park"],
  pet: ["pet"],
  night: ["night_aesthetic"],
  evening: ["night_aesthetic"],
  rain: ["rainy_mood"],
  rainy: ["rainy_mood"],
  cozy: ["cozy_vibe"],
  comfy: ["cozy_vibe"]
}

/**
 * Resolve LLM-provided image context tags to visual reference categories.
 * Always includes "portrait" when imageSelf is true.
 */
export function resolveReferenceCategories(imageContext: string[], imageSelf: boolean): VisualReferenceCategory[] {
  const categories = new Set<VisualReferenceCategory>()

  if (imageSelf) {
    categories.add("portrait")
  }

  for (const tag of imageContext) {
    const normalized = tag.toLowerCase().replace(/[\s-]/g, "_")
    const mapped = CONTEXT_CATEGORY_MAP[normalized]

    if (mapped) {
      for (const category of mapped) {
        categories.add(category)
      }
    } else if (VisualReferenceCategoryEnum.safeParse(normalized).success) {
      categories.add(normalized as VisualReferenceCategory)
    } else {
      log.debug("Unknown image context tag", { tag: normalized })
    }
  }

  return [...categories]
}
