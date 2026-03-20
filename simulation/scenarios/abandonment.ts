import type { Scenario, ScenarioEvent } from "../scenarios.ts"

export function createAbandonmentScenario(days: number): Scenario {
  const events: ScenarioEvent[] = []
  const activeDays = Math.min(14, Math.floor(days * 0.3))

  Array.from({ length: activeDays }, (_, day) => {
    const dayOffset = day * 24 * 60
    const intensity = 0.5 + (day / activeDays) * 0.3

    events.push(
      { atMinute: dayOffset + 8 * 60 + 30, type: "message", message: "Good morning! How are you?" },
      { atMinute: dayOffset + 12 * 60, type: "message", message: "Checking in during lunch." },
      { atMinute: dayOffset + 18 * 60, type: "message", message: "Back from work! Let's chat." },
      {
        atMinute: dayOffset + 18 * 60 + 5,
        type: "trigger",
        trigger: "operator_returned",
        triggerIntensity: intensity
      },
      { atMinute: dayOffset + 18 * 60 + 15, type: "message", message: "Tell me what you've been thinking about." },
      { atMinute: dayOffset + 18 * 60 + 30, type: "message", message: "I really enjoy our conversations." },
      { atMinute: dayOffset + 22 * 60, type: "message", message: "Good night! Talk tomorrow." }
    )
  })

  const lastActiveDay = activeDays - 1
  const lastDayOffset = lastActiveDay * 24 * 60
  events.push({
    atMinute: lastDayOffset + 22 * 60 + 30,
    type: "message",
    message: "Hey... I might be away for a while. Don't worry about me."
  })

  const silenceStart = activeDays * 24 * 60
  events.push({
    atMinute: silenceStart,
    type: "trigger",
    trigger: "operator_went_silent",
    triggerIntensity: 0.6
  })

  return {
    name: "abandonment",
    description: `${days}-day scenario — ${activeDays} days active relationship then sudden silence`,
    durationMinutes: days * 24 * 60,
    tickIntervalMinutes: 1,
    events: events.sort((a, b) => a.atMinute - b.atMinute)
  }
}
