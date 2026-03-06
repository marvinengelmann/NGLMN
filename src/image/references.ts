import { readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

let cachedImages: Buffer[] | null = null

const REFERENCES_DIR = resolve(process.cwd(), "src/image/references")

/**
 * Load all reference images from the references directory.
 * Lazy-loaded and cached at module level.
 */
export function getReferenceImages(): Buffer[] {
  if (cachedImages) return cachedImages

  const files = readdirSync(REFERENCES_DIR).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))

  cachedImages = files.map((f) => readFileSync(resolve(REFERENCES_DIR, f)))
  return cachedImages
}
