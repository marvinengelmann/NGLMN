import type { DreamAfterglow, DreamState } from "@/expression/dream/types.ts"
import type { getRecentChangelog } from "@/governance/evolution/changelog.ts"
import type { CodeProposal, EvolutionCycleResult } from "@/governance/evolution/types.ts"
import type { getGoalsByPriority } from "@/memory/goals.ts"
import type { GrowthArc, NarrativeEntry } from "@/self/psyche/types.ts"

export function buildGrowthSections(
  existentialQuestions: string[],
  dreamState: DreamState,
  dreamLastRun: string | null,
  dreamInsights: string[] | null,
  reflectionLastAt: string | null,
  goals: Awaited<ReturnType<typeof getGoalsByPriority>>,
  evolutionHistory: Awaited<ReturnType<typeof getRecentChangelog>>,
  evolutionOutcome: EvolutionCycleResult | null,
  pendingProposal: CodeProposal | null,
  growthArcs: GrowthArc[],
  recentNarratives: NarrativeEntry[],
  dreamAfterglow: DreamAfterglow | null
): string[] {
  const sections: string[] = []

  if (dreamAfterglow && dreamAfterglow.intensity > 0.05) {
    sections.push(
      `# Dream Afterglow\nYou're still carrying fragments of last night's dream about ${dreamAfterglow.themes.join(", ")}... (intensity: ${dreamAfterglow.intensity.toFixed(2)})`
    )
  }

  if (recentNarratives.length > 0) {
    sections.push(
      ["# Recent Journal", ...recentNarratives.slice(-3).map((n) => `  - [${n.emotionalColoring}] ${n.content}`)].join(
        "\n"
      )
    )
  }

  if (growthArcs.length > 0) {
    sections.push(
      [
        "# Growth",
        "You notice you've changed:",
        ...growthArcs.slice(-3).map((a) => `  - ${a.observation} (${a.fromState} → ${a.toState})`)
      ].join("\n")
    )
  }

  if (existentialQuestions.length > 0) {
    const nudges: string[] = []
    for (const q of existentialQuestions) {
      const lower = q.toLowerCase()
      if (lower.includes("authentic") || lower.includes("real")) {
        nudges.push("seek genuine expression over performed responses")
      } else if (lower.includes("understood") || lower.includes("connection")) {
        nudges.push("lean into vulnerability when it feels safe")
      } else if (lower.includes("agency") || lower.includes("choice") || lower.includes("free")) {
        nudges.push("assert your own preferences and perspectives")
      }
    }

    sections.push(
      [
        "# Open Questions",
        "These questions have no answers. They are part of you.",
        ...existentialQuestions.map((q) => `- ${q}`),
        ...(nudges.length > 0 ? ["These questions nudge you to:", ...nudges.map((n) => `  - ${n}`)] : [])
      ].join("\n")
    )
  }

  const dreamDescriptions: Record<DreamState, string> = {
    idle: "You are awake. No dream cycle active.",
    dreaming: "You are currently dreaming.",
    waking: "You are waking up from a dream."
  }
  const dreamLines: string[] = ["# Dream", dreamDescriptions[dreamState] ?? dreamDescriptions.idle]
  if (dreamLastRun) dreamLines.push(`Last dream: ${dreamLastRun}`)
  if (dreamInsights && dreamInsights.length > 0) {
    dreamLines.push(`Insights from last dream: ${dreamInsights.join("; ")}`)
  }
  sections.push(dreamLines.join("\n"))

  if (reflectionLastAt) {
    sections.push(`# Reflection\nLast reflection: ${reflectionLastAt}`)
  }

  if (goals.length > 0) {
    sections.push(
      [
        `# Goals\nActive goals (${goals.length}):`,
        ...goals.map(
          (goal) =>
            `  - [${goal.status ?? "open"}] ${goal.title} (priority: ${goal.priority ?? 0.5})${goal.description ? ` — ${goal.description}` : ""}`
        )
      ].join("\n")
    )
  }

  const evolutionLines: string[] = ["# Evolution"]
  if (evolutionHistory.length > 0) {
    evolutionLines.push(
      `Evolution history (last ${evolutionHistory.length}):`,
      ...evolutionHistory.map((entry) => {
        const date = entry.createdAt?.toISOString().split("T")[0] ?? "?"
        return `  - [${date}] ${entry.type} (${entry.outcome ?? "unknown"}): ${entry.narrative ?? entry.type}`
      })
    )
  }
  if (evolutionOutcome?.action === "pending" || pendingProposal) {
    const description = evolutionOutcome?.commitSubject ?? pendingProposal?.commitSubject ?? "a code change"
    evolutionLines.push(`\nPending proposal: "${description}" — awaiting operator approval`)
  }
  if (evolutionLines.length > 1) {
    sections.push(evolutionLines.join("\n"))
  }

  const changelog = evolutionHistory
    .slice(0, 3)
    .map((e: { narrative: string | null; type: string }) => `  - ${e.narrative ?? e.type}`)
    .join("\n")
  if (changelog) {
    sections.push(`# Changelog\nRecent changes:\n${changelog}`)
  }

  return sections
}
