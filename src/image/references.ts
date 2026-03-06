import { readFileSync } from "node:fs"
import { resolve } from "node:path"

let cached: Buffer | null = null

const REFERENCE_PATH = resolve(process.cwd(), "src/image/reference/anima.png")

/**
 * Load the single reference image of ANIMA's appearance.
 * Lazy-loaded and cached at module level.
 */
export function getReferenceImage(): Buffer {
  if (cached) return cached
  cached = readFileSync(REFERENCE_PATH)
  return cached
}
