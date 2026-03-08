import { experimental_generateImage as generateImage } from "ai"
import { IMAGE } from "@/config/constants.ts"
import { redis } from "@/integrations/redis.ts"
import { log } from "@/lib/logger.ts"
import { getIdentityPortraitPrompt } from "@/prompts/image.ts"

const IMAGE_MODEL = "xai/grok-imagine-image"

let cached: Buffer | null = null

/**
 * Load ANIMAs reference image for visual consistency.
 * Resolution order: memory cache → Redis → generate fresh.
 */
export async function getReferenceImage(): Promise<Buffer> {
  if (cached) return cached

  const stored = await redis.get<string>(IMAGE.REFERENCE_KEY)
  if (stored) {
    cached = Buffer.from(stored, "base64")
    return cached
  }

  log.info("Generating initial reference image")

  const result = await generateImage({
    model: IMAGE_MODEL,
    prompt: await getIdentityPortraitPrompt(),
    aspectRatio: "1:1"
  })

  const image = result.images[0]
  if (!image) throw new Error("Failed to generate reference image")

  cached = Buffer.from(image.base64, "base64")
  await redis.set(IMAGE.REFERENCE_KEY, image.base64)

  return cached
}
