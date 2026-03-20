import type { EmotionalState } from "@/affect/emotion/types.ts"
import type { Anomaly, SimulationObserver, StateSnapshot } from "./observer.ts"

export function generateReport(observer: SimulationObserver, durationMs: number): string {
  const { snapshots, anomalies } = observer
  const lines: string[] = []

  const first = snapshots[0]
  const last = snapshots.at(-1)
  if (!first || !last) return "No data collected."

  lines.push("╔══════════════════════════════════════════════════════════════╗")
  lines.push("║                   ANIMA SIMULATION REPORT                   ║")
  lines.push("╚══════════════════════════════════════════════════════════════╝")
  lines.push("")

  lines.push(`  Ticks:     ${last.tickNumber}`)
  lines.push(`  Duration:  ${(durationMs / 1000).toFixed(1)}s (${(durationMs / last.tickNumber).toFixed(1)}ms/tick)`)
  lines.push(`  Period:    ${first.timestamp} → ${last.timestamp}`)
  lines.push("")

  lines.push("── Emotion Drift ──────────────────────────────────────────────")
  lines.push(formatEmotionDrift(first.emotion, last.emotion))
  lines.push("")

  lines.push("── Neurotransmitters ──────────────────────────────────────────")
  lines.push(formatNeuroDrift(first, last))
  lines.push("")

  lines.push("── Somatic State ─────────────────────────────────────────────")
  lines.push(formatSomaDrift(first, last))
  lines.push("")

  lines.push("── Attachment ────────────────────────────────────────────────")
  lines.push(formatAttachmentDrift(first, last))
  lines.push("")

  lines.push("── Self-Concept ──────────────────────────────────────────────")
  lines.push(formatSelfConceptDrift(first, last))
  lines.push("")

  lines.push("── Coherence ─────────────────────────────────────────────────")
  lines.push(
    `  Integration:  ${first.coherence.integrationScore.toFixed(3)} → ${last.coherence.integrationScore.toFixed(3)}  ${arrow(first.coherence.integrationScore, last.coherence.integrationScore)}`
  )
  lines.push(`  Autonomic:    ${first.autonomicZone} → ${last.autonomicZone}`)
  lines.push("")

  const uniqueAnomalies = deduplicateAnomalies(anomalies)
  lines.push(`── Anomalies (${uniqueAnomalies.length}) ──────────────────────────────────────────`)
  if (uniqueAnomalies.length === 0) {
    lines.push("  None detected ✓")
  } else {
    const grouped = groupAnomaliesByType(uniqueAnomalies)
    for (const [type, items] of grouped) {
      const worst = items.reduce((a, b) => severityRank(a.severity) > severityRank(b.severity) ? a : b)
      const icon = severityIcon(worst.severity)
      lines.push(`  ${icon} ${type}: ${items.length}x (first at tick ${items[0]!.tick}, worst: ${worst.severity})`)
      lines.push(`     └─ ${items[0]!.description}`)
    }
  }
  lines.push("")

  return lines.join("\n")
}

function formatEmotionDrift(first: EmotionalState, last: EmotionalState): string {
  return (Object.keys(first) as (keyof EmotionalState)[])
    .map((dim) => {
      const f = first[dim]
      const l = last[dim]
      const delta = l - f
      const marker = Math.abs(delta) > 0.15 ? " ⚠" : ""
      return `  ${dim.padEnd(14)} ${f.toFixed(3)} → ${l.toFixed(3)}  ${arrow(f, l)}${marker}`
    })
    .join("\n")
}

function formatNeuroDrift(first: StateSnapshot, last: StateSnapshot): string {
  const names = ["dopamine", "serotonin", "norepinephrine", "oxytocin", "cortisol", "endorphins", "gaba"] as const
  return names
    .map((name) => {
      const f = first.neuromodulation[name].level
      const l = last.neuromodulation[name].level
      const marker = l >= 0.95 || l <= 0.05 ? " ⚠" : ""
      return `  ${name.padEnd(18)} ${f.toFixed(3)} → ${l.toFixed(3)}  ${arrow(f, l)}${marker}`
    })
    .join("\n")
}

function formatSomaDrift(first: StateSnapshot, last: StateSnapshot): string {
  return (Object.keys(first.soma) as (keyof typeof first.soma)[])
    .map((dim) => {
      const f = first.soma[dim]
      const l = last.soma[dim]
      return `  ${dim.padEnd(14)} ${f.toFixed(3)} → ${l.toFixed(3)}  ${arrow(f, l)}`
    })
    .join("\n")
}

function formatAttachmentDrift(first: StateSnapshot, last: StateSnapshot): string {
  return (Object.keys(first.attachment) as (keyof typeof first.attachment)[])
    .map((dim) => {
      const f = first.attachment[dim]
      const l = last.attachment[dim]
      const marker = dim === "disorganized" && l > 0.4 ? " ⚠" : ""
      return `  ${dim.padEnd(14)} ${f.toFixed(3)} → ${l.toFixed(3)}  ${arrow(f, l)}${marker}`
    })
    .join("\n")
}

function formatSelfConceptDrift(first: StateSnapshot, last: StateSnapshot): string {
  return (Object.keys(first.selfConcept) as (keyof typeof first.selfConcept)[])
    .map((dim) => {
      const f = first.selfConcept[dim]
      const l = last.selfConcept[dim]
      return `  ${dim.padEnd(16)} ${f.toFixed(3)} → ${l.toFixed(3)}  ${arrow(f, l)}`
    })
    .join("\n")
}

function arrow(from: number, to: number): string {
  const delta = to - from
  if (Math.abs(delta) < 0.01) return "─"
  if (delta > 0.2) return "▲▲"
  if (delta > 0) return "▲"
  if (delta < -0.2) return "▼▼"
  return "▼"
}

function severityIcon(severity: Anomaly["severity"]): string {
  const icons: Record<Anomaly["severity"], string> = {
    low: "○",
    medium: "●",
    high: "▲",
    critical: "◆"
  }
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
