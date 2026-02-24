/**
 * Clamp a value to the [0, 1] range.
 */
export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/**
 * Estimate token count from a text string (~4 chars per token).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Estimate total token count from multiple text sections.
 */
export function estimateTokensFromSections(sections: string[]): number {
  return sections.reduce((sum, s) => sum + estimateTokens(s), 0)
}
