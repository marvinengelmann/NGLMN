import { analyzeSnapshots, type AnalysisResult, type WeeklyAggregate } from "./analysis.ts"
import { generateDiagnostics, type DiagnosticInsight } from "./diagnostics.ts"
import type { Anomaly, SimulationObserver, StateSnapshot } from "./observer.ts"

export function generateReport(
  observer: SimulationObserver,
  durationMs: number,
  tickIntervalMinutes: number,
  snapshotInterval: number
): string {
  const { snapshots, anomalies } = observer
  const lines: string[] = []

  const first = snapshots[0]
  const last = snapshots.at(-1)
  if (!first || !last) return "No data collected."

  const analysis = analyzeSnapshots(snapshots, tickIntervalMinutes, snapshotInterval)
  const diagnostics = generateDiagnostics(analysis)

  renderOverview(lines, first, last, snapshots, durationMs, analysis)
  renderTimeSeriesSummary(lines, analysis)
  renderWeeklyEvolution(lines, analysis)
  renderSaturationWarnings(lines, analysis, tickIntervalMinutes)
  renderStabilityAnalysis(lines, analysis)
  renderPhaseBreakdown(lines, analysis)
  renderDiagnosticInsights(lines, diagnostics)
  renderEventDistribution(lines, snapshots)
  renderAnomalies(lines, anomalies)

  return lines.join("\n")
}

function renderOverview(
  lines: string[],
  first: StateSnapshot,
  last: StateSnapshot,
  snapshots: StateSnapshot[],
  durationMs: number,
  analysis: AnalysisResult
) {
  lines.push("╔══════════════════════════════════════════════════════════════╗")
  lines.push("║                   ANIMA SIMULATION REPORT                   ║")
  lines.push("╚══════════════════════════════════════════════════════════════╝")
  lines.push("")
  lines.push(`  Ticks:       ${last.tickNumber}`)
  lines.push(`  Duration:    ${(durationMs / 1000).toFixed(1)}s (${(durationMs / last.tickNumber).toFixed(1)}ms/tick)`)
  lines.push(`  Period:      ${first.timestamp} → ${last.timestamp}`)
  lines.push(`  Days:        ${analysis.totalDays.toFixed(1)}`)
  lines.push(`  Snapshots:   ${snapshots.length}`)
  lines.push("")
}

function renderTimeSeriesSummary(lines: string[], analysis: AnalysisResult) {
  lines.push("── Time-Series Summary ────────────────────────────────────────")
  lines.push(`  ${"Metric".padEnd(24)} ${"Start".padStart(7)} ${"End".padStart(7)} ${"Min".padStart(7)} ${"Max".padStart(7)} ${"Mean".padStart(7)} ${"StdDev".padStart(7)} ${"Trend/d".padStart(8)}`)
  lines.push(`  ${"─".repeat(24)} ${"─".repeat(7)} ${"─".repeat(7)} ${"─".repeat(7)} ${"─".repeat(7)} ${"─".repeat(7)} ${"─".repeat(7)} ${"─".repeat(8)}`)

  const sortedMetrics = [...analysis.metrics.entries()].sort(
    (a, b) => Math.abs(b[1].stats.trendPerDay) - Math.abs(a[1].stats.trendPerDay)
  )

  for (const [name, metric] of sortedMetrics) {
    const { stats } = metric
    if (stats.stddev < 0.005 && Math.abs(stats.trendPerDay) < 0.001) continue

    const trendArrow = trendIndicator(stats.trendPerDay)
    const warn = Math.abs(stats.trendPerDay) > 0.03 ? " !" : ""

    lines.push(
      `  ${name.padEnd(24)} ${f(stats.start)} ${f(stats.end)} ${f(stats.min)} ${f(stats.max)} ${f(stats.mean)} ${f(stats.stddev)} ${ft(stats.trendPerDay)} ${trendArrow}${warn}`
    )
  }
  lines.push("")
}

function renderWeeklyEvolution(lines: string[], analysis: AnalysisResult) {
  if (analysis.weeklyAggregates.length < 2) return

  const significantMetrics = findSignificantWeeklyMetrics(analysis.weeklyAggregates)
  if (significantMetrics.length === 0) return

  lines.push("── Weekly Evolution ───────────────────────────────────────────")

  for (const metricName of significantMetrics.slice(0, 12)) {
    lines.push(`  ${metricName}:`)
    for (const week of analysis.weeklyAggregates) {
      const mean = week.means[metricName]
      const delta = week.deltas[metricName]
      if (mean === undefined) continue

      const deltaStr = week.weekNumber === 1
        ? "(baseline)"
        : `${delta! >= 0 ? "+" : ""}${delta!.toFixed(3)}`
      const warn = Math.abs(delta ?? 0) > 0.05 ? " !" : ""

      lines.push(`    Week ${String(week.weekNumber).padStart(2)} (day ${String(week.startDay).padStart(2)}-${String(week.endDay).padStart(2)}): ${mean.toFixed(3)}  ${deltaStr}${warn}`)
    }
    lines.push("")
  }
}

function renderSaturationWarnings(lines: string[], analysis: AnalysisResult, tickIntervalMinutes: number) {
  if (analysis.saturations.length === 0) return

  lines.push("── Saturation Warnings ────────────────────────────────────────")
  for (const sat of analysis.saturations) {
    const pct = (sat.percentOfTime * 100).toFixed(0)
    const icon = sat.percentOfTime >= 0.5 ? "◆" : "▲"
    const dayEst = estimateDay(sat.firstOccurrenceTick, tickIntervalMinutes)
    lines.push(`  ${icon} ${sat.metric}: at ${sat.side} ${pct}% of time (first at tick ${sat.firstOccurrenceTick}, ~day ${dayEst})`)
  }
  lines.push("")
}

function renderStabilityAnalysis(lines: string[], analysis: AnalysisResult) {
  if (analysis.highVarianceMetrics.length === 0 && analysis.tooStableMetrics.length === 0) return

  lines.push("── Stability Analysis ─────────────────────────────────────────")

  if (analysis.highVarianceMetrics.length > 0) {
    const details = analysis.highVarianceMetrics
      .map((name) => {
        const m = analysis.metrics.get(name)
        return m ? `${name} (σ=${m.stats.stddev.toFixed(3)})` : name
      })
      .join(", ")
    lines.push(`  High variance:  ${details}`)
  }

  if (analysis.tooStableMetrics.length > 0) {
    const details = analysis.tooStableMetrics
      .map((name) => {
        const m = analysis.metrics.get(name)
        return m ? `${name} (σ=${m.stats.stddev.toFixed(3)})` : name
      })
      .join(", ")
    lines.push(`  Too stable:     ${details}`)
  }

  lines.push("")
}

function renderPhaseBreakdown(lines: string[], analysis: AnalysisResult) {
  const metricsWithPhases = [...analysis.metrics.entries()]
    .filter(([_, m]) => m.phases.length > 1)
    .sort((a, b) => b[1].phases.length - a[1].phases.length)

  if (metricsWithPhases.length === 0) return

  lines.push("── Phase Breakdown ────────────────────────────────────────────")

  for (const [name, metric] of metricsWithPhases.slice(0, 10)) {
    lines.push(`  ${name}:`)
    for (const phase of metric.phases) {
      const rateStr = phase.ratePerDay !== 0 ? `, ${phase.ratePerDay >= 0 ? "+" : ""}${phase.ratePerDay.toFixed(4)}/day` : ""
      lines.push(`    Day ${String(phase.startDay).padStart(2)}-${String(phase.endDay).padStart(2)}: ${phase.type.padEnd(15)} (mean ${phase.meanValue.toFixed(3)}${rateStr})`)
    }
    lines.push("")
  }
}

function renderDiagnosticInsights(lines: string[], diagnostics: DiagnosticInsight[]) {
  lines.push("══════════════════════════════════════════════════════════════")
  lines.push("  DIAGNOSTIC INSIGHTS (Finetuning Recommendations)")
  lines.push("══════════════════════════════════════════════════════════════")

  if (diagnostics.length === 0) {
    lines.push("  No issues detected. All metrics within expected ranges.")
    lines.push("")
    return
  }

  const criticals = diagnostics.filter((d) => d.severity === "critical")
  const warnings = diagnostics.filter((d) => d.severity === "warning")
  const infos = diagnostics.filter((d) => d.severity === "info")

  if (criticals.length > 0) {
    lines.push("")
    lines.push(`  --- CRITICAL (${criticals.length}) ---`)
    for (const insight of criticals) {
      renderInsight(lines, insight)
    }
  }

  if (warnings.length > 0) {
    lines.push("")
    lines.push(`  --- WARNING (${warnings.length}) ---`)
    for (const insight of warnings) {
      renderInsight(lines, insight)
    }
  }

  if (infos.length > 0) {
    lines.push("")
    lines.push(`  --- INFO (${infos.length}) ---`)
    for (const insight of infos) {
      renderInsight(lines, insight)
    }
  }

  lines.push("")
}

function renderInsight(lines: string[], insight: DiagnosticInsight) {
  const tag = insight.severity === "critical" ? "CRITICAL" : insight.severity === "warning" ? "WARNING" : "INFO"
  lines.push("")
  lines.push(`  [${tag}] ${insight.metric}`)
  lines.push(`    ${insight.observation}`)
  lines.push(`    → ${insight.recommendation}`)
  for (const ref of insight.constants) {
    lines.push(`      File: ${ref.file}`)
    lines.push(`      ${ref.constant}.${ref.path} = ${ref.currentValue}`)
  }
}

function renderEventDistribution(lines: string[], snapshots: StateSnapshot[]) {
  let totalMessages = 0
  const totalTriggers: Record<string, number> = {}
  const actionCounts: Record<string, number> = {}

  for (const snap of snapshots) {
    totalMessages += snap.messageCount
    for (const [trigger, count] of Object.entries(snap.triggerCounts)) {
      totalTriggers[trigger] = (totalTriggers[trigger] ?? 0) + count
    }
    actionCounts[snap.action] = (actionCounts[snap.action] ?? 0) + 1
  }

  lines.push("── Event Distribution ─────────────────────────────────────────")
  lines.push(`  Messages received: ${totalMessages}`)

  const triggerEntries = Object.entries(totalTriggers).sort((a, b) => b[1] - a[1])
  if (triggerEntries.length > 0) {
    lines.push("  Triggers:")
    for (const [trigger, count] of triggerEntries) {
      lines.push(`    ${trigger.padEnd(24)} ${count}x`)
    }
  }

  const actionEntries = Object.entries(actionCounts).sort((a, b) => b[1] - a[1])
  const totalActions = actionEntries.reduce((sum, [_, c]) => sum + c, 0)
  lines.push("  Actions:")
  for (const [action, count] of actionEntries) {
    const pct = ((count / totalActions) * 100).toFixed(1)
    lines.push(`    ${action.padEnd(12)} ${String(count).padStart(6)}  (${pct}%)`)
  }
  lines.push("")
}

function renderAnomalies(lines: string[], anomalies: Anomaly[]) {
  const unique = deduplicateAnomalies(anomalies)
  const grouped = groupAnomaliesByType(unique)

  lines.push(`── Anomalies (${unique.length} unique, ${anomalies.length} total) ─────────────────────────`)

  if (unique.length === 0) {
    lines.push("  None detected")
    lines.push("")
    return
  }

  for (const [type, items] of grouped) {
    const worst = items.reduce((a, b) => severityRank(a.severity) > severityRank(b.severity) ? a : b)
    const firstTick = items[0]!.tick
    const lastTick = items.at(-1)!.tick
    const icon = severityIcon(worst.severity)
    const range = firstTick === lastTick ? `tick ${firstTick}` : `ticks ${firstTick}-${lastTick}`
    lines.push(`  ${icon} ${type}: ${items.length}x (${range}, worst: ${worst.severity})`)
    lines.push(`     └─ ${items[0]!.description}`)
  }

  lines.push("")
}

function f(value: number): string {
  return value.toFixed(3).padStart(7)
}

function ft(trendPerDay: number): string {
  const sign = trendPerDay >= 0 ? "+" : ""
  return `${sign}${trendPerDay.toFixed(4)}`.padStart(8)
}

function trendIndicator(trendPerDay: number): string {
  if (Math.abs(trendPerDay) < 0.001) return "─"
  if (trendPerDay > 0.03) return "▲▲"
  if (trendPerDay > 0) return "▲"
  if (trendPerDay < -0.03) return "▼▼"
  return "▼"
}

function estimateDay(tick: number, tickIntervalMinutes: number): number {
  const ticksPerDay = 1440 / tickIntervalMinutes
  return Math.max(1, Math.round(tick / ticksPerDay))
}

function findSignificantWeeklyMetrics(weeks: WeeklyAggregate[]): string[] {
  if (weeks.length < 2) return []

  const metricMaxDelta = new Map<string, number>()

  for (const week of weeks) {
    for (const [name, delta] of Object.entries(week.deltas)) {
      const current = metricMaxDelta.get(name) ?? 0
      metricMaxDelta.set(name, Math.max(current, Math.abs(delta)))
    }
  }

  return [...metricMaxDelta.entries()]
    .filter(([_, maxDelta]) => maxDelta > 0.02)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
}

function severityIcon(severity: Anomaly["severity"]): string {
  const icons: Record<Anomaly["severity"], string> = { low: "○", medium: "●", high: "▲", critical: "◆" }
  return icons[severity]
}

function severityRank(severity: Anomaly["severity"]): number {
  const ranks: Record<Anomaly["severity"], number> = { low: 0, medium: 1, high: 2, critical: 3 }
  return ranks[severity]
}

function deduplicateAnomalies(anomalies: Anomaly[]): Anomaly[] {
  const seen = new Map<string, Anomaly>()
  for (const anomaly of anomalies) {
    const key = `${anomaly.type}:${anomaly.description}`
    const existing = seen.get(key)
    if (!existing || severityRank(anomaly.severity) > severityRank(existing.severity)) {
      seen.set(key, anomaly)
    }
  }
  return [...seen.values()].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
}

function groupAnomaliesByType(anomalies: Anomaly[]): Map<string, Anomaly[]> {
  const grouped = new Map<string, Anomaly[]>()
  for (const anomaly of anomalies) {
    const existing = grouped.get(anomaly.type) ?? []
    existing.push(anomaly)
    grouped.set(anomaly.type, existing)
  }
  return grouped
}
