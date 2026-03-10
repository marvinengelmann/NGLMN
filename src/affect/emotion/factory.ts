import type * as z from "zod"
import { createStateManager } from "@/infra/lib/state.ts"
import { registerSecondaryEmotion } from "./registry.ts"
import type { EmotionEffect, SecondaryEmotionState } from "./types.ts"

interface EmotionDefinition<TState extends SecondaryEmotionState> {
  name: string
  redisKey: string
  order: number
  schema: z.ZodType<TState>
  // biome-ignore lint/suspicious/noExplicitAny: compute contexts vary per emotion
  compute: (context: any) => TState
  computeEffect: (state: TState) => EmotionEffect
}

/**
 * Define and register a secondary emotion in one step.
 * Derives the default state from the schema, creates the state manager, and registers the emotion.
 */
export function defineSecondaryEmotion<TState extends SecondaryEmotionState>(definition: EmotionDefinition<TState>) {
  const defaultState = definition.schema.parse({}) as TState
  const { get, save } = createStateManager(definition.redisKey, definition.schema, defaultState)

  registerSecondaryEmotion({
    name: definition.name,
    redisKey: definition.redisKey,
    schema: definition.schema,
    defaultState,
    order: definition.order,
    compute: definition.compute,
    computeEffect: definition.computeEffect
  })

  return { get, save, defaultState }
}
