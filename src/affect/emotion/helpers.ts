export function sumContributions<T extends string>(
  contributions: { source: T; value: number }[]
): { level: number; source: T | null; maxContribution: number } {
  return contributions.reduce(
    (acc, c) => ({
      level: acc.level + c.value,
      source: c.value > acc.maxContribution ? c.source : acc.source,
      maxContribution: Math.max(acc.maxContribution, c.value)
    }),
    { level: 0, source: null as T | null, maxContribution: 0 }
  )
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

/**
 * Fluent builder for emotion contributions — replaces verbose push patterns.
 */
export class Contributions<T extends string> {
  private items: { source: T; value: number }[] = []

  add(condition: boolean, source: T, value: number): this {
    if (condition) this.items.push({ source, value })
    return this
  }

  sum(): { level: number; source: T | null; maxContribution: number } {
    return sumContributions(this.items)
  }

  decay(
    previousLevel: number,
    decayPerTick: number,
    activationThreshold: number
  ): { level: number; source: T | null; finalLevel: number; isActive: boolean } {
    const { level, source } = this.sum()
    const { finalLevel, isActive } = decayAndFinalize(previousLevel, level, decayPerTick, activationThreshold)
    return { level, source, finalLevel, isActive }
  }
}

export function contributions<T extends string>(): Contributions<T> {
  return new Contributions<T>()
}
