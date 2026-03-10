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
