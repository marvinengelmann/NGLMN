import { experimental_generateImage as generateImage } from "ai"
import { trackApiCost } from "@/core/budget.ts"
import type { AnimaResultAsync } from "@/lib/result.ts"
import { trySafe } from "@/lib/result.ts"
import { buildImagePrompt } from "@/prompts/image.ts"
import { getReferenceImage } from "./references.ts"

const IMAGE_MODEL = "xai/grok-imagine-image"
const COST_PER_IMAGE = 0.07

/**
 * Generate an image using xAI Grok Imagine via the AI Gateway.
 * When includesSelf is true, reference images are passed for visual consistency.
 * @param prompt - English image generation prompt.
 * @param includesSelf - Whether the image includes ANIMA's appearance.
 * @param aspectRatio - Aspect ratio for the generated image.
 */
export function generateAnimaImage(
  prompt: string,
  includesSelf: boolean,
  aspectRatio: "1:1" | "16:9" | "9:16" = "1:1"
): AnimaResultAsync<Buffer> {
  return trySafe("LLM_ERROR", async () => {
    const fullPrompt = buildImagePrompt(prompt, includesSelf)

    const result = await generateImage({
      model: IMAGE_MODEL,
      prompt: includesSelf ? { text: fullPrompt, images: [await getReferenceImage()] } : fullPrompt,
      aspectRatio
    })

    const image = result.images[0]
    if (!image) throw new Error("No image returned from generation")

    await trackApiCost(COST_PER_IMAGE)

    return Buffer.from(image.base64, "base64")
  })
}
