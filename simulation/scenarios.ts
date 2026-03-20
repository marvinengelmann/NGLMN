import type { EmotionTrigger } from "@/affect/emotion/types.ts"

export type ScenarioEventType = "message" | "silence" | "mood_shift" | "trigger"

export interface ScenarioEvent {
  atMinute: number
  type: ScenarioEventType
  message?: string
  trigger?: EmotionTrigger
  triggerIntensity?: number
  triggerDetail?: string
}

export interface Scenario {
  name: string
  description: string
  durationMinutes: number
  tickIntervalMinutes: number
  events: ScenarioEvent[]
}

export interface ScenarioContext {
  pendingMessages: Array<{ text: string; date: number }>
  triggers: Array<{ trigger: EmotionTrigger; intensity: number; detail?: string }>
  operatorSilenceMinutes: number
  inConversation: boolean
}

export function resolveEventsForTick(
  scenario: Scenario,
  tickStartMinute: number,
  tickEndMinute: number,
  totalElapsedMinutes: number
): ScenarioContext {
  const events = scenario.events.filter(
    (e) => e.atMinute >= tickStartMinute && e.atMinute < tickEndMinute
  )

  const messages = events
    .filter((e) => e.type === "message" && e.message)
    .map((e) => ({
      text: e.message!,
      date: Math.floor(Date.now() / 1000)
    }))

  const triggers = events
    .filter((e) => e.type === "trigger" && e.trigger)
    .map((e) => ({
      trigger: e.trigger!,
      intensity: e.triggerIntensity ?? 0.5,
      detail: e.triggerDetail
    }))

  const lastMessageMinute = scenario.events
    .filter((e) => e.type === "message" && e.atMinute <= tickEndMinute)
    .reduce((max, e) => Math.max(max, e.atMinute), -1)

  const operatorSilenceMinutes = lastMessageMinute >= 0 ? totalElapsedMinutes - lastMessageMinute : totalElapsedMinutes
  const inConversation = messages.length > 0 || operatorSilenceMinutes < 30

  return { pendingMessages: messages, triggers, operatorSilenceMinutes, inConversation }
}
