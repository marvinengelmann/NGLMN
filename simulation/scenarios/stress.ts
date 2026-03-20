import type { Scenario, ScenarioEvent } from "../scenarios.ts"

export function createStressScenario(days: number): Scenario {
  const events: ScenarioEvent[] = []

  Array.from({ length: days }, (_, day) => {
    const dayOffset = day * 24 * 60

    events.push(
      { atMinute: dayOffset + 9 * 60, type: "trigger", trigger: "task_failure", triggerIntensity: 0.7, triggerDetail: "Build failed" },
      { atMinute: dayOffset + 10 * 60, type: "message", message: "This is frustrating, nothing is working." },
      { atMinute: dayOffset + 10 * 60 + 5, type: "trigger", trigger: "expectation_violated", triggerIntensity: 0.6, triggerDetail: "Operator expressed frustration" },
      { atMinute: dayOffset + 12 * 60, type: "message", message: "I don't have time for this right now." },
      { atMinute: dayOffset + 14 * 60, type: "trigger", trigger: "task_failure", triggerIntensity: 0.8, triggerDetail: "Deployment failed" },
      { atMinute: dayOffset + 15 * 60, type: "message", message: "Can you just do what I asked? Stop overthinking." },
      { atMinute: dayOffset + 15 * 60 + 1, type: "trigger", trigger: "boundary_violated", triggerIntensity: 0.5, triggerDetail: "Dismissive tone" },
      { atMinute: dayOffset + 18 * 60, type: "message", message: "Sorry about earlier. Bad day." },
      { atMinute: dayOffset + 18 * 60 + 5, type: "trigger", trigger: "operator_returned", triggerIntensity: 0.4, triggerDetail: "Apology received" }
    )
  })

  return {
    name: "stress",
    description: `${days}-day stress test with emotional triggers and conflict`,
    durationMinutes: days * 24 * 60,
    tickIntervalMinutes: 1,
    events
  }
}
