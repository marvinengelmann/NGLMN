import type { Scenario, ScenarioEvent } from "../scenarios.ts"

export function createNeglectScenario(days: number): Scenario {
  const events: ScenarioEvent[] = [
    { atMinute: 5, type: "message", message: "Hey, I'll be away for a while. Take care!" }
  ]

  return {
    name: "neglect",
    description: `${days}-day neglect scenario — single message then complete silence`,
    durationMinutes: days * 24 * 60,
    tickIntervalMinutes: 1,
    events
  }
}
