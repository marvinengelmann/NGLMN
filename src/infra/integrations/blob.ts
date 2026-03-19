import { del, put } from "@vercel/blob"
import type { VisualReferenceCategory } from "@/expression/image/types.ts"

/**
 * Upload a visual reference image to Vercel Blob Store.
 * Returns the public CDN URL for the stored image.
 */
export async function uploadVisualReference(category: VisualReferenceCategory, buffer: Buffer): Promise<string> {
  const path = `visual-references/${category}/${Date.now()}.png`
  const { downloadUrl } = await put(path, buffer, { access: "private" })
  return downloadUrl
}

/**
 * Delete a visual reference image from Vercel Blob Store.
 */
export async function deleteVisualReference(blobUrl: string): Promise<void> {
  await del(blobUrl)
}
