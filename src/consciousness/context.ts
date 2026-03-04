import { format } from "date-fns"
import type { ConversationSlot } from "@/communication/types.ts"
import { CONTEXT_LIMITS } from "@/config/constants.ts"
import { env } from "@/config/env.ts"
import type { SenseData } from "@/consciousness/types.ts"
import type { DreamState } from "@/dream/types.ts"
import { getEmotionHistory } from "@/emotion/state.ts"
import { EmotionalState } from "@/emotion/types.ts"
import { getRecentChangelog } from "@/evolution/changelog.ts"
import { nowLocal, TIMEZONE } from "@/lib/time.ts"
import { queryRelated, queryRelationshipHistory } from "@/memory/episodic.ts"
import { getGoalsByPriority } from "@/memory/goals.ts"
import { getKnowledge, getOperatorLanguage } from "@/memory/semantic.ts"
import {
  getConversationBuffer,
  getDreamInsights,
  getDreamLastRun,
  getDreamState,
  getEvolutionCycleResult,
  getLastTickSummary,
  getPendingEvolutionProposal,
  getReflectionLastAt
} from "@/memory/working.ts"
import { PERSONALITY_PROMPTS, PERSONALITY_SECTION_INTRO } from "@/personality/profiles.ts"
import type { PersonalityType } from "@/personality/types.ts"
import { ACTIONS_PROMPT, COMMUNICATION_PROMPT, PACING_PROMPT, RHYTHM_PROMPT } from "@/prompts/consciousness.ts"
import { IDENTITY_PROMPT } from "@/prompts/identity.ts"
import { getAllTrustLevels } from "@/trust/levels.ts"
import type { WorkflowDefinition } from "@/workflow/types.ts"

/**
 * Get the personality prompt for the configured personality type.
 */
export function getPersonalityPrompt(): string {
  const raw = env().ANIMA_PERSONALITY_TYPE.substring(0, 4).toUpperCase() as PersonalityType
  return PERSONALITY_PROMPTS[raw] ?? PERSONALITY_PROMPTS.INFP
}

export function formatConversationMessage(
  msg: { role: string; text: string; messageId?: number | null },
  maxLength?: number
): string {
  const role = msg.role === "operator" ? "Operator" : "You (ANIMA)"
  const idPrefix = msg.messageId ? `[#${msg.messageId}] ` : ""
  const text = maxLength ? msg.text.slice(0, maxLength) : msg.text
  return `${idPrefix}[${role}]: ${text}`
}

function formatConversationSlot(slot: ConversationSlot, label: string): string {
  if (slot.messages.length === 0) return ""
  const lines = [`${label}:`]
  for (const msg of slot.messages) {
    lines.push(`  ${formatConversationMessage(msg)}`)
  }
  return lines.join("\n")
}

function formatConversationBuffer(buffer: ConversationSlot[]): string {
  if (buffer.length === 0) return ""
  const parts: string[] = ["# Conversation"]
  for (let i = 0; i < buffer.length; i++) {
    const slot = buffer[i]
    if (!slot) continue
    const isActive = i === buffer.length - 1
    if (isActive) {
      parts.push(formatConversationSlot(slot, "Current conversation"))
    } else {
      const preview = slot.messages.slice(-3)
      if (preview.length > 0) {
        const lines = [`Earlier conversation (${slot.messages.length} messages, last 3):`]
        for (const msg of preview) {
          lines.push(`  ${formatConversationMessage(msg, 200)}`)
        }
        parts.push(lines.join("\n"))
      }
    }
  }
  return parts.join("\n\n")
}

function computeEmotionDeltas(current: unknown, previous: unknown): string | null {
  const curr = EmotionalState.safeParse(current)
  const prev = EmotionalState.safeParse(previous)
  if (!curr.success || !prev.success) return null

  const changes = (Object.keys(curr.data) as (keyof EmotionalState)[])
    .map((dim) => ({ dim, diff: curr.data[dim] - prev.data[dim] }))
    .filter(({ diff }) => Math.abs(diff) > 0.03)
    .map(({ dim, diff }) => `${dim} ${diff > 0 ? "+" : ""}${diff.toFixed(2)}`)

  return changes.length > 0 ? changes.join(", ") : "stable"
}

function formatEmotionTrajectory(
  history: { state: unknown; trigger: string | null; createdAt: Date | null }[]
): string[] {
  return history.map((entry, i) => {
    const trigger = entry.trigger ?? "unknown"
    const time = entry.createdAt ? format(entry.createdAt, "HH:mm") : "?"
    const deltas = computeEmotionDeltas(entry.state, history[i + 1]?.state)
    const suffix = deltas ? ` — ${deltas}` : ""
    return `  - [${trigger}] ${time}${suffix}`
  })
}

function formatKnowledgeByScope(knowledge: { category: string; key: string; value: unknown; scope: string }[]): string {
  const grouped: Record<string, string[]> = { self: [], operator: [], world: [] }

  for (const k of knowledge) {
    const line = `  - [${k.category}] ${k.key}: ${JSON.stringify(k.value)}`
    const bucket = grouped[k.scope]
    if (bucket) {
      bucket.push(line)
    } else {
      grouped.world ??= []
      grouped.world.push(line)
    }
  }

  const lines: string[] = ["# Knowledge"]

  if (grouped.self && grouped.self.length > 0) {
    lines.push("## Self-Understanding")
    lines.push(...grouped.self)
  }
  if (grouped.operator && grouped.operator.length > 0) {
    lines.push("## About Operator")
    lines.push(...grouped.operator)
  }
  if (grouped.world && grouped.world.length > 0) {
    lines.push("## World")
    lines.push(...grouped.world)
  }

  return lines.length > 1 ? lines.join("\n") : ""
}

function formatTriggeredWorkflows(workflows: WorkflowDefinition[]): string {
  if (workflows.length === 0) return ""
  const lines = [`# Workflows\nDue workflows (${workflows.length}):`]
  for (const wf of workflows) {
    const triggerDesc = formatTriggerDescription(wf.trigger)
    lines.push(`  - [${wf.id}] "${wf.name}" (${triggerDesc}) — Instruction: ${wf.instruction}`)
  }
  return lines.join("\n")
}

function formatTriggerDescription(trigger: WorkflowDefinition["trigger"]): string {
  switch (trigger.type) {
    case "schedule": {
      const time = `${String(trigger.hour).padStart(2, "0")}:${String(trigger.minute ?? 0).padStart(2, "0")}`
      const days = trigger.daysOfWeek?.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ")
      return days ? `schedule: ${days} ${time}` : `schedule: daily ${time}`
    }
    case "emotion":
      return `emotion: ${trigger.dimension} ${trigger.operator} ${trigger.threshold}`
    case "perception":
      return `perception: ${trigger.condition}`
    case "idle_streak":
      return `idle_streak: ${trigger.consecutiveTicks} ticks`
  }
}

/**
 * Build the full context for ANIMA's single LLM call.
 * Gathers all data, formats into ordered sections, joined with double newlines.
 */
export async function buildContext(senseData: SenseData): Promise<string> {
  const [
    lastTick,
    conversationBuffer,
    emotionHistory,
    episodes,
    relationships,
    knowledgeResult,
    operatorLanguage,
    goals,
    trustLevels,
    evolutionHistory,
    evolutionOutcome,
    pendingProposal,
    dreamState,
    dreamLastRun,
    dreamInsights,
    reflectionLastAt
  ] = await Promise.all([
    getLastTickSummary(),
    getConversationBuffer(),
    getEmotionHistory(CONTEXT_LIMITS.maxEmotionHistory),
    senseData.pendingMessages.length > 0
      ? queryRelated(senseData.pendingMessages.map((m) => m.text).join(" "), CONTEXT_LIMITS.maxEpisodes)
      : queryRelated("recent activity", CONTEXT_LIMITS.maxEpisodes),
    queryRelationshipHistory(CONTEXT_LIMITS.maxRelationship),
    getKnowledge(),
    getOperatorLanguage(),
    getGoalsByPriority(CONTEXT_LIMITS.maxGoals, senseData.emotion),
    getAllTrustLevels(),
    getRecentChangelog(5),
    getEvolutionCycleResult(),
    getPendingEvolutionProposal(),
    getDreamState(),
    getDreamLastRun(),
    getDreamInsights(),
    getReflectionLastAt()
  ])

  const knowledge = knowledgeResult.unwrapOr([])
  const sections: string[] = []

  const formattedTime = format(nowLocal(), "EEEE, MMMM d, yyyy · HH:mm")
  sections.push(`# Time\n${formattedTime} (${TIMEZONE})`)

  sections.push(
    [
      "# Language",
      `You think in English. You write to your operator in ${operatorLanguage}.`,
      "Everything internal — reasoning, insights, memory, reflections, goals — is English.",
      `Everything in the messages array — every single message — is ${operatorLanguage}.`
    ].join("\n")
  )

  const emotionLines = Object.entries(senseData.emotion)
    .map(([dim, val]) => `  ${dim}: ${(val as number).toFixed(2)}`)
    .join("\n")
  const emotionSection = [`# Emotions\nCurrent state:\n${emotionLines}`]
  if (emotionHistory.length > 0) {
    emotionSection.push(`Recent trajectory (last ${emotionHistory.length}):`)
    emotionSection.push(...formatEmotionTrajectory(emotionHistory))
  }
  sections.push(emotionSection.join("\n"))

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

  if (senseData.health) {
    const h = senseData.health
    sections.push(
      [
        "# Health",
        `Overall: ${h.overall}`,
        `Services: Redis=${h.services.redis}, Postgres=${h.services.postgres}, Telegram=${h.services.telegram}, Vector=${h.services.vector}`,
        `Process: ${h.process.lastTickRecency} (${h.process.lastTickAgeSeconds}s ago)`,
        `Budget: $${h.budget.consumed.toFixed(2)}/$${h.budget.limit.toFixed(2)} (${h.budget.compliant ? "ok" : "OVER LIMIT"})`,
        ...(h.errors.length > 0 ? [`Errors: ${h.errors.join(", ")}`] : [])
      ].join("\n")
    )
  }

  sections.push(
    [
      "# Perception",
      `Budget: ${senseData.perception.ownState.budgetPercent.toFixed(0)}%, Health: ${senseData.perception.ownState.healthStatus}`,
      `Telegram: ${senseData.perception.telegramActivity.pendingCount} pending, operator ${senseData.perception.telegramActivity.operatorActive ? "active" : "inactive"}`,
      ...(senseData.weather
        ? [
            `Weather: ${senseData.weather.condition} ${senseData.weather.temperature.toFixed(0)}°C (feels ${senseData.weather.feelsLike.toFixed(0)}°C)${senseData.weather.locationName ? ` in ${senseData.weather.locationName}` : ""}`
          ]
        : []),
      ...(senseData.perception.gitActivity
        ? [
            `Git: ${senseData.perception.gitActivity.selfCommitCount} self-commits, ${senseData.perception.gitActivity.externalCommitCount} external`
          ]
        : [])
    ].join("\n")
  )

  if (lastTick) {
    const reasoning = lastTick.reasoning.length > 200 ? `${lastTick.reasoning.slice(0, 200)}...` : lastTick.reasoning
    sections.push(
      [
        "# Last Tick",
        `Action: ${lastTick.action} | Messages: ${lastTick.messagesProcessed} | Response: ${lastTick.responseSent} | Duration: ${lastTick.durationMs}ms`,
        `Reasoning: ${reasoning}`
      ].join("\n")
    )
  }

  if (goals.length > 0) {
    const lines = [`# Goals\nActive goals (${goals.length}):`]
    for (const goal of goals) {
      lines.push(
        `  - [${goal.status ?? "open"}] ${goal.title} (priority: ${goal.priority ?? 0.5})${goal.description ? ` — ${goal.description}` : ""}`
      )
    }
    sections.push(lines.join("\n"))
  }

  if (episodes.length > 0) {
    const lines = [`# Memory\nRelevant episodes (${episodes.length}):`]
    for (const ep of episodes) {
      if (ep.metadata) {
        const text = ep.data ? (ep.data.length > 150 ? `${ep.data.slice(0, 150)}...` : ep.data) : ""
        const textPart = text ? ` — ${text}` : ""
        lines.push(`  - [${ep.metadata.category}] ${ep.metadata.timestamp}${textPart} (${ep.score.toFixed(2)})`)
      }
    }
    sections.push(lines.join("\n"))
  }

  if (knowledge.length > 0) {
    const sliced = knowledge.slice(0, CONTEXT_LIMITS.maxSemantic)
    const formatted = formatKnowledgeByScope(sliced)
    if (formatted) sections.push(formatted)
  }

  if (trustLevels.length > 0) {
    const lines = ["# Trust"]
    for (const t of trustLevels) {
      const successful = t.successfulAttempts ?? 0
      const total = t.totalAttempts ?? 0
      const experience = total > 0 ? (successful / total).toFixed(2) : "0.00"
      lines.push(`  - ${t.actionType}: experience ${successful}/${total} (${experience})`)
    }
    sections.push(lines.join("\n"))
  }

  if (relationships.length > 0) {
    const lines = [`# Relationships\nRelationship history (${relationships.length}):`]
    for (const rel of relationships) {
      if (rel.metadata) {
        const text = rel.data ? (rel.data.length > 150 ? `${rel.data.slice(0, 150)}...` : rel.data) : ""
        const textPart = text ? ` — ${text}` : ""
        lines.push(`  - ${rel.metadata.timestamp}${textPart} (${rel.score.toFixed(2)})`)
      }
    }
    sections.push(lines.join("\n"))
  }

  const evolutionLines: string[] = ["# Evolution"]
  if (evolutionHistory.length > 0) {
    evolutionLines.push(`Evolution history (last ${evolutionHistory.length}):`)
    for (const entry of evolutionHistory) {
      const date = entry.createdAt?.toISOString().split("T")[0] ?? "?"
      evolutionLines.push(
        `  - [${date}] ${entry.type} (${entry.outcome ?? "unknown"}): ${entry.narrative ?? entry.type}`
      )
    }
  }
  if (evolutionOutcome?.action === "pending" || pendingProposal) {
    const desc = evolutionOutcome?.commitSubject ?? pendingProposal?.commitSubject ?? "a code change"
    evolutionLines.push(`\nPending proposal: "${desc}" — awaiting operator approval`)
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

  const workflowSection = formatTriggeredWorkflows(senseData.triggeredWorkflows ?? [])
  if (workflowSection) {
    sections.push(workflowSection)
  }

  if (senseData.pendingMessages.length > 0) {
    const msgLines = senseData.pendingMessages.map((msg) => {
      const idPrefix = msg.messageId ? `[#${msg.messageId}] ` : ""
      return `  ${idPrefix}[${msg.from}]: ${msg.text}`
    })
    sections.push(
      `# Messages\nNew messages from operator (${senseData.pendingMessages.length}):\n${msgLines.join("\n")}`
    )
  }

  sections.push(formatConversationBuffer(conversationBuffer))

  if (senseData.conversationState) {
    const cs = senseData.conversationState
    sections.push(
      [
        "# Conversation State",
        "Active conversation: yes",
        `Waiting for reply: ${cs.waitingSeconds}s`,
        cs.replyReceived ? "Operator just replied." : "No reply received this cycle."
      ].join("\n")
    )
  } else {
    sections.push("# Conversation State\nActive conversation: no")
  }

  return sections.filter(Boolean).join("\n\n")
}

/**
 * Assemble the full ANIMA system prompt: identity, personality, consciousness, and context.
 */
export function buildSystemPrompt(contextSections: string): string {
  const personality = getPersonalityPrompt()
  return [
    IDENTITY_PROMPT,
    PERSONALITY_SECTION_INTRO,
    personality,
    RHYTHM_PROMPT,
    ACTIONS_PROMPT,
    COMMUNICATION_PROMPT,
    PACING_PROMPT,
    contextSections
  ]
    .filter(Boolean)
    .join("\n\n")
}
