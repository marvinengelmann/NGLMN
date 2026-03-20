import { parseArgs } from "util"
import { createBaselineScenario } from "./scenarios/baseline.ts"
import { createConversationScenario } from "./scenarios/conversation.ts"
import { createNeglectScenario } from "./scenarios/neglect.ts"
import { createStressScenario } from "./scenarios/stress.ts"
import { runSimulation } from "./runner.ts"
import type { Scenario } from "./scenarios.ts"

const SCENARIOS: Record<string, (days: number) => Scenario> = {
  baseline: createBaselineScenario,
  neglect: createNeglectScenario,
  conversation: createConversationScenario,
  stress: createStressScenario
}

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    scenario: { type: "string", short: "s", default: "baseline" },
    days: { type: "string", short: "d", default: "1" },
    "tick-interval": { type: "string", short: "t", default: "1" },
    "snapshot-interval": { type: "string", default: "60" }
  },
  strict: true
})

const scenarioName = values.scenario ?? "baseline"
const days = Number.parseFloat(values.days ?? "1")
const tickInterval = Number.parseFloat(values["tick-interval"] ?? "1")
const snapshotInterval = Number.parseInt(values["snapshot-interval"] ?? "60", 10)

const scenarioFactory = SCENARIOS[scenarioName]
if (!scenarioFactory) {
  console.error(`Unknown scenario: ${scenarioName}`)
  console.error(`Available: ${Object.keys(SCENARIOS).join(", ")}`)
  process.exit(1)
}

const scenario = scenarioFactory(days)
scenario.tickIntervalMinutes = tickInterval

console.log("╔══════════════════════════════════════════════════════════════╗")
console.log("║                   ANIMA SIMULATION ENGINE                   ║")
console.log("╚══════════════════════════════════════════════════════════════╝")
console.log("")
console.log(`  Scenario:       ${scenario.name} — ${scenario.description}`)
console.log(`  Duration:       ${days} day(s) (${scenario.durationMinutes} minutes)`)
console.log(`  Tick interval:  ${tickInterval} minute(s)`)
console.log(`  Total ticks:    ${Math.ceil(scenario.durationMinutes / tickInterval)}`)
console.log(`  Events:         ${scenario.events.length}`)
console.log("")

const result = await runSimulation({
  scenario,
  snapshotEveryNTicks: snapshotInterval
})

console.log(result.report)
