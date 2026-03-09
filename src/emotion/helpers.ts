export function sumContributions<T extends string>(
  contributions: { source: T; value: number }[]
): { level: number; source: T | null; maxContribution: number } {
  let level = 0
  let source: T | null = null
  let maxContribution = 0

  for (const c of contributions) {
    level += c.value
    if (c.value > maxContribution) {
      maxContribution = c.value
      source = c.source
    }
  }

  return { level, source, maxContribution }
}

export function decayAndFinalize(
  previousLevel: number,
  newLevel: number,
  decayPerTick: number,
  activationThreshold: number
): { finalLevel: number; isActive: boolean } {
  const decayedLevel = previousLevel * decayPerTick
  const finalLevel = Math.min(1, Math.max(decayedLevel, newLevel))
  const isActive = finalLevel > activationThreshold
  return { finalLevel, isActive }
}
