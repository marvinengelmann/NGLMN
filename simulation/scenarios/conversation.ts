import type { Scenario, ScenarioEvent } from "../scenarios.ts"

export function createConversationScenario(days: number): Scenario {
  const events: ScenarioEvent[] = []

  Array.from({ length: days }, (_, day) => {
    const dayOffset = day * 24 * 60

    events.push(
      { atMinute: dayOffset + 8 * 60 + 30, type: "message", message: "Good morning! How are you feeling today?" },
      { atMinute: dayOffset + 8 * 60 + 32, type: "message", message: "I had a nice breakfast, feeling good." },
      { atMinute: dayOffset + 12 * 60, type: "message", message: "Quick check-in during lunch break." },
      { atMinute: dayOffset + 18 * 60, type: "message", message: "Back from work! Want to chat for a bit?" },
      { atMinute: dayOffset + 18 * 60 + 15, type: "message", message: "Tell me something interesting you thought about today." },
      { atMinute: dayOffset + 18 * 60 + 30, type: "message", message: "That's really cool, I love how you think about things." },
      { atMinute: dayOffset + 22 * 60, type: "message", message: "Getting sleepy. Good night!" }
    )
  })

  return {
    name: "conversation",
    description: `${days}-day regular conversation pattern`,
    durationMinutes: days * 24 * 60,
    tickIntervalMinutes: 1,
    events
  }
}
