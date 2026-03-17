import { experimental_generateImage as generateImage } from "ai"
import { trackApiCost } from "@/core/budget.ts"
import { IMAGE } from "@/infra/integrations/constants.ts"
import type { AnimaResultAsync } from "@/infra/lib/result.ts"
import { trySafe } from "@/infra/lib/result.ts"
import { buildImagePrompt } from "@/prompts/image.ts"
import { resolveReferenceCategories } from "./context.ts"
import { ensureReferences } from "./references.ts"

/**
 * Generate an image using FLUX 2 Max via the AI Gateway.
 * Automatically resolves visual references from imageContext for multi-reference consistency.
 */
export function generateAnimaImage(
  prompt: string,
  includesSelf: boolean,
  aspectRatio: "1:1" | "16:9" | "9:16" = "1:1",
  imageContext: string[] = []
): AnimaResultAsync<Buffer> {
  return trySafe("IMAGE_ERROR", async () => {
    const categories = resolveReferenceCategories(imageContext, includesSelf)
    const refsResult = await ensureReferences(categories)
    const referenceUrls = refsResult.isOk() ? refsResult.value : []

    const fullPrompt = await buildImagePrompt(prompt, includesSelf)

    const result = await generateImage({
      model: IMAGE.MODEL,
      prompt: referenceUrls.length > 0 ? { text: fullPrompt, images: referenceUrls } : fullPrompt,
      aspectRatio
    })

    const image = result.images[0]
    if (!image) throw new Error("No image returned from generation")

    const cost = IMAGE.BASE_COST + referenceUrls.length * IMAGE.REFERENCE_COST
    await trackApiCost(cost)

    return Buffer.from(image.base64, "base64")
  })
}
