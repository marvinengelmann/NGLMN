import { experimental_generateImage as generateImage } from "ai"
import type { AnimaResultAsync } from "@/infra/lib/result.ts"
import { trySafe } from "@/infra/lib/result.ts"
import { trackApiCost } from "./budget.ts"
import { IMAGE } from "./providers.ts"

const BASE_COST = 0.07
const REFERENCE_COST = 0.03

interface CallImagingOptions {
  prompt: string
  referenceImages?: string[]
  aspectRatio?: "1:1" | "16:9" | "9:16"
}

/**
 * Unified image generation call — direct BFL/Flux provider.
 * Tracks cost internally; callers receive only the image buffer.
 */
export function callImaging(options: CallImagingOptions): AnimaResultAsync<Buffer> {
  return trySafe("IMAGE_ERROR", async () => {
    const { prompt, referenceImages = [], aspectRatio = "1:1" } = options

    const result = await generateImage({
      model: IMAGE,
      prompt: referenceImages.length > 0 ? { text: prompt, images: referenceImages } : prompt,
      aspectRatio
    })

    const image = result.images[0]
    if (!image) throw new Error("No image returned from generation")

    const cost = BASE_COST + referenceImages.length * REFERENCE_COST
    await trackApiCost(cost)

    return Buffer.from(image.base64, "base64")
  })
}
