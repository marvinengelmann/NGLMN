import type { Scenario } from "../scenarios.ts"

export function createBaselineScenario(days: number): Scenario {
  return {
    name: "baseline",
    description: `${days}-day baseline with no operator interaction`,
    durationMinutes: days * 24 * 60,
    tickIntervalMinutes: 1,
    events: []
  }
}
