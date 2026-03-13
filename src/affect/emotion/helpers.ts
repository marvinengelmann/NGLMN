function sumContributions<T extends string>(
  items: { source: T; value: number }[]
): { level: number; source: T | null; maxContribution: number } {
  return items.reduce(
    (acc, c) => ({
      level: acc.level + c.value,
      source: c.value > acc.maxContribution ? c.source : acc.source,
      maxContribution: Math.max(acc.maxContribution, c.value)
    }),
    { level: 0, source: null as T | null, maxContribution: 0 }
  )
}

/**
 * Decay the previous level and blend in new contributions.
 *
 * Rising stimuli get an instant response (jump to newLevel).
 * Sustained or declining stimuli follow an EMA that converges
 * to the current contribution level — so ongoing stimulation
 * no longer blocks decay entirely.
 */
export function decayAndFinalize(
  previousLevel: number,
  newLevel: number,
  decayPerTick: number,
  activationThreshold: number
): { finalLevel: number; isActive: boolean } {
  const decayedLevel = previousLevel * decayPerTick
  const emaLevel = decayedLevel + newLevel * (1 - decayPerTick)
  const rising = newLevel > previousLevel
  const finalLevel = Math.min(1, rising ? Math.max(emaLevel, newLevel) : emaLevel)
  const isActive = finalLevel > activationThreshold
  return { finalLevel, isActive }
}

export type Contributions<T extends string> = ReturnType<typeof contributions<T>>

/**
 * Fluent builder for emotion contributions — replaces verbose push patterns.
 */
export function contributions<T extends string>() {
  const items: { source: T; value: number }[] = []

  const builder = {
    add(condition: boolean, source: T, value: number) {
      if (condition) items.push({ source, value })
      return builder
    },

    sum(): { level: number; source: T | null; maxContribution: number } {
      return sumContributions(items)
    },

    decay(
      previousLevel: number,
      decayPerTick: number,
      activationThreshold: number
    ): { level: number; source: T | null; finalLevel: number; isActive: boolean } {
      const { level, source } = sumContributions(items)
      const { finalLevel, isActive } = decayAndFinalize(previousLevel, level, decayPerTick, activationThreshold)
      return { level, source, finalLevel, isActive }
    }
  }

  return builder
}
