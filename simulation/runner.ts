import { createClock } from "./clock.ts"
import { generateDecision } from "./decisions.ts"
import { createObserver, type SimulationObserver } from "./observer.ts"
import { generateReport } from "./report.ts"
import { resolveEventsForTick, type Scenario } from "./scenarios.ts"
import { createInitialState, type SimulationState } from "./state.ts"
import { computeTick } from "./tick.ts"

export interface SimulationConfig {
  scenario: Scenario
  snapshotEveryNTicks: number
  timezone?: string
  startTime?: Date
}

export interface SimulationResult {
  finalState: SimulationState
  observer: SimulationObserver
  report: string
  durationMs: number
  totalTicks: number
}

export async function runSimulation(config: SimulationConfig): Promise<SimulationResult> {
  const startTime = config.startTime ?? new Date("2026-03-20T08:00:00")
  const clock = createClock(startTime, config.timezone)
  const observer = createObserver(config.snapshotEveryNTicks)

  let state = createInitialState(clock)
  let previousState: SimulationState | null = null

  const totalTicks = Math.ceil(config.scenario.durationMinutes / config.scenario.tickIntervalMinutes)
  const runStart = performance.now()

  const progressInterval = Math.max(1, Math.floor(totalTicks / 20))

  for (const tickIndex of Array.from({ length: totalTicks }, (_, i) => i)) {
    const tickStartMinute = tickIndex * config.scenario.tickIntervalMinutes
    const tickEndMinute = tickStartMinute + config.scenario.tickIntervalMinutes

    const context = resolveEventsForTick(
      config.scenario,
      tickStartMinute,
      tickEndMinute,
      clock.totalElapsedMinutes
    )

    const decision = generateDecision(state, context.pendingMessages.length > 0, clock)

    state = await computeTick(state, context, decision, clock)

    observer.recordEvents(
      context.triggers.map((t) => t.trigger),
      context.pendingMessages.length
    )
    observer.record(state, decision.action)
    observer.detectAnomalies(state, previousState)

    previousState = state
    clock.advance(config.scenario.tickIntervalMinutes)

    if (tickIndex % progressInterval === 0) {
      const percent = ((tickIndex / totalTicks) * 100).toFixed(0)
      process.stdout.write(`\r  Simulating... ${percent}% (tick ${tickIndex}/${totalTicks})`)
    }
  }

  process.stdout.write(`\r  Simulating... 100% (${totalTicks} ticks)            \n\n`)

  const durationMs = performance.now() - runStart
  const report = generateReport(observer, durationMs, config.scenario.tickIntervalMinutes, config.snapshotEveryNTicks)

  return { finalState: state, observer, report, durationMs, totalTicks }
}
