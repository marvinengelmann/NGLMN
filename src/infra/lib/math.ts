/**
 * Clamp a value to the [0, 1] range.
 */
export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/**
 * Exponential half-life decay factor. Returns how much of the original value remains.
 */
export function halfLifeDecay(elapsed: number, halfLife: number): number {
  return 2 ** (-elapsed / halfLife)
}

/**
 * Fisher-Yates shuffle — returns a new shuffled copy of the array.
 */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array]
  Array.from({ length: result.length - 1 }, (_, k) => result.length - 1 - k).forEach((i) => {
    const j = Math.floor(Math.random() * (i + 1))
    const swapped = result[i] as T
    result[i] = result[j] as T
    result[j] = swapped
  })
  return result
}
