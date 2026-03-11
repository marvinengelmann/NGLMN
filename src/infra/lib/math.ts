/**
 * Clamp a value to the [min, max] range.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Clamp a value to the [0, 1] range.
 */
export function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

/**
 * Exponential half-life decay factor. Returns how much of the original value remains.
 */
export function halfLifeDecay(elapsed: number, halfLife: number): number {
  return 2 ** (-elapsed / halfLife)
}

/**
 * Apply numeric deltas to a state object, clamping each result to [0, 1].
 * Returns a shallow copy — the original state is not mutated.
 */
export function applyClampedDeltas<T extends Record<string, number>>(
  state: T,
  deltas: Partial<Record<keyof T, number>>,
  excludeKeys?: ReadonlySet<string>
): T {
  const result = { ...state }
  for (const [key, delta] of Object.entries(deltas)) {
    if (key in result && typeof delta === "number" && !excludeKeys?.has(key)) {
      ;(result as Record<string, number>)[key] = clamp01((result[key as keyof T] as number) + delta)
    }
  }
  return result
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
