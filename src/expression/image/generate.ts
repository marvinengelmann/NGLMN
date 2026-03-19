import { callImaging } from "@/core/imaging.ts"
import type { AnimaResultAsync } from "@/infra/lib/result.ts"
import { trySafe } from "@/infra/lib/result.ts"
import { buildImagePrompt } from "@/prompts/image.ts"
import { resolveReferenceCategories } from "./context.ts"
import { ensureReferences } from "./references.ts"

/**
 * Generate an image using FLUX 2 Max.
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
    const referenceImages = refsResult.isOk() ? refsResult.value : []

    const fullPrompt = await buildImagePrompt(prompt, includesSelf)

    const result = await callImaging({ prompt: fullPrompt, referenceImages, aspectRatio })
    if (result.isErr()) throw result.error.cause ?? new Error(result.error.message)

    return result.value
  })
}
