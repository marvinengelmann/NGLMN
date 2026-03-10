import type * as z from "zod"
import type { EmotionalState, SecondaryEmotionState } from "./types.ts"

export interface SecondaryEmotionEntry<TState extends SecondaryEmotionState = SecondaryEmotionState> {
  name: string
  redisKey: string
  schema: z.ZodType<TState>
  defaultState: TState
  order: number
  // biome-ignore lint/suspicious/noExplicitAny: registry accepts heterogeneous compute signatures
  compute: (context: any) => TState
  computeEffect?: (state: TState) => Partial<Record<keyof EmotionalState, number>>
}

const registry = new Map<string, SecondaryEmotionEntry>()

export function registerSecondaryEmotion<TState extends SecondaryEmotionState>(
  entry: SecondaryEmotionEntry<TState>
): void {
  registry.set(entry.name, entry as unknown as SecondaryEmotionEntry)
}

export function getRegisteredEmotions(): SecondaryEmotionEntry[] {
  return Array.from(registry.values()).sort((a, b) => a.order - b.order)
}

export function getRegisteredEmotion(name: string): SecondaryEmotionEntry | undefined {
  return registry.get(name)
}
