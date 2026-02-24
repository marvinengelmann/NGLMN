import { differenceInMinutes, formatISO, parseISO } from "date-fns"
import type { ConversationMessage } from "@/bridge/types.ts"
import { TIERS } from "@/config/constants.ts"
import type { TickSummary } from "@/core/types.ts"
import { getEmotionHistory } from "@/emotion/state.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import type { PendingMessage } from "@/integrations/types.ts"
import { estimateTokens } from "@/lib/math.ts"
import { queryRelated, queryRelationshipHistory } from "@/memory/episodic.ts"
import { getGoalsByPriority } from "@/memory/goals.ts"
import { getKnowledge, getOperatorLanguage } from "@/memory/semantic.ts"
import {
  getConversationHistory,
  getCurrentEmotion,
  getLastProactiveAction,
  getLastTickSummary,
  getPerceptionSummary
} from "@/memory/working.ts"
import type { PerceptionSummary } from "@/perception/types.ts"
import { loadPersonalityDna } from "@/personality/dna.ts"
import { getAllTrustLevels } from "@/trust/levels.ts"

interface ContextSection {
  label: string
  content: string
  priority: number
}

/**
 * Truncate context sections to fit within a token budget, prioritized by importance.
 */
export function truncateToTokenBudget(sections: ContextSection[], budgetTokens: number): string {
  const sorted = [...sections].sort((a, b) => b.priority - a.priority)
  const included: string[] = []
  let tokensUsed = 0

  for (const section of sorted) {
    const sectionTokens = estimateTokens(section.content)
    if (tokensUsed + sectionTokens <= budgetTokens) {
      included.push(section.content)
      tokensUsed += sectionTokens
    } else {
      const remaining = budgetTokens - tokensUsed
      if (remaining > 50) {
        const truncated = section.content.slice(0, remaining * 4)
        included.push(`${truncated}\n...(truncated)`)
        tokensUsed += remaining
      }
      break
    }
  }

  return included.join("\n\n")
}

/**
 * Format conversation history into a labeled text block.
 */
function formatConversationHistory(history: ConversationMessage[]): string {
  if (history.length === 0) return ""
  const lines = ["Conversation history:"]
  for (const msg of history) {
    const label = msg.role === "operator" ? "Operator" : "You (ANIMA)"
    lines.push(`  [${label}]: ${msg.text}`)
  }
  return lines.join("\n")
}

export interface TriageContext {
  now: string
  lastTick: TickSummary | null
  userPrompt: string
}

/**
 * Format emotional state as a compact summary line.
 */
function formatEmotionSummary(emotion: EmotionalState): string {
  const high = Object.entries(emotion)
    .filter(([, v]) => v > 0.6)
    .map(([k, v]) => `${k}: ${v.toFixed(2)}`)
    .join(", ")
  const low = Object.entries(emotion)
    .filter(([, v]) => v < 0.3)
    .map(([k, v]) => `${k}: ${v.toFixed(2)}`)
    .join(", ")
  const parts: string[] = []
  if (high) parts.push(`High: ${high}`)
  if (low) parts.push(`Low: ${low}`)
  return parts.length > 0 ? parts.join(" | ") : "Balanced"
}

/**
 * Format perception summary as a compact block.
 */
function formatPerceptionBlock(perception: PerceptionSummary): string {
  const lines: string[] = ["Perception:"]
  lines.push(`  Budget: ${perception.ownState.budgetPercent.toFixed(0)}%, Health: ${perception.ownState.healthStatus}`)
  lines.push(
    `  Telegram: ${perception.telegramActivity.pendingCount} pending, operator ${perception.telegramActivity.operatorActive ? "active" : "inactive"}`
  )
  if (perception.emailActivity) {
    lines.push(
      `  Email: ${perception.emailActivity.pendingCount} pending, ${perception.emailActivity.hasNewEmail ? "new email" : "no new email"}`
    )
  }
  return lines.join("\n")
}

/**
 * Build a compact context for the Haiku triage phase.
 * Includes time, last tick, conversation indicator, pending messages, top goals,
 * emotional state, and perception summary.
 */
export async function buildTriageContext(): Promise<TriageContext> {
  const now = formatISO(new Date())
  const [lastTick, conversationHistory, emotion, perception, lastProactive] = await Promise.all([
    getLastTickSummary(),
    getConversationHistory(),
    getCurrentEmotion(),
    getPerceptionSummary(),
    getLastProactiveAction()
  ])

  const topGoals = await getGoalsByPriority(TIERS.triage.maxGoals, emotion ?? undefined)

  const parts: string[] = []
  parts.push(`Current time: ${now}`)

  if (lastTick) {
    parts.push(
      `Last tick: ${lastTick.timestamp} — decision: ${lastTick.triageDecision}, reason: ${lastTick.triageReason}`
    )
  } else {
    parts.push("Last tick: none (first tick)")
  }

  if (conversationHistory.length > 0) {
    parts.push(`Active conversation: ${conversationHistory.length} messages in current session`)
  }

  if (emotion) {
    parts.push(`Emotional state: ${formatEmotionSummary(emotion)}`)
  }

  if (perception) {
    parts.push(formatPerceptionBlock(perception))
  }

  if (lastProactive) {
    const minutesAgo = differenceInMinutes(new Date(), parseISO(lastProactive.timestamp))
    parts.push(`Last proactive action: ${lastProactive.action}, ${minutesAgo}m ago`)
  }

  if (topGoals.length > 0) {
    parts.push(`Active goals (top ${topGoals.length}):`)
    for (const goal of topGoals) {
      parts.push(
        `  - [${goal.status}] ${goal.title} (priority: ${goal.priority})${goal.description ? ` — ${goal.description}` : ""}`
      )
    }
  }

  return {
    now,
    lastTick,
    userPrompt: parts.join("\n")
  }
}

/**
 * Build context for Haiku simple-tier responses.
 * Includes personality prompt, conversation history, top 3 relevant episodes, and pending messages.
 */
export async function buildSimpleContext(messages: PendingMessage[], personalityPrompt?: string): Promise<string> {
  const now = formatISO(new Date())
  const [conversationHistory, episodes, operatorLanguage] = await Promise.all([
    getConversationHistory(),
    messages.length > 0
      ? queryRelated(messages.map((m) => m.text).join(" "), TIERS.simple.maxEpisodes)
      : Promise.resolve([]),
    getOperatorLanguage()
  ])

  const parts: string[] = []
  parts.push(`Current time: ${now}`)
  parts.push(`Operator's preferred language: ${operatorLanguage}`)
  parts.push("")

  if (personalityPrompt) {
    parts.push(personalityPrompt)
    parts.push("")
  }

  const historyBlock = formatConversationHistory(conversationHistory)
  if (historyBlock) {
    parts.push(historyBlock)
    parts.push("")
  }

  if (episodes.length > 0) {
    parts.push("Relevant memories:")
    for (const ep of episodes) {
      if (ep.metadata) {
        parts.push(`  - [${ep.metadata.category}] (relevance: ${ep.score.toFixed(2)})`)
      }
    }
    parts.push("")
  }

  if (messages.length > 0) {
    parts.push("New messages to respond to:")
    for (const msg of messages) {
      parts.push(`[${msg.from}]: ${msg.text}`)
    }
  }

  return parts.join("\n")
}

function formatEpisodeSection(
  episodes: { score: number; metadata?: { category: string; timestamp: string } }[]
): string {
  if (episodes.length === 0) return ""
  const lines = [`Relevant memories (${episodes.length}):`]
  for (const ep of episodes) {
    if (ep.metadata) {
      lines.push(`  - [${ep.metadata.category}] ${ep.metadata.timestamp} (score: ${ep.score.toFixed(2)})`)
    }
  }
  return lines.join("\n")
}

function formatRelationshipSection(relationships: { score: number; metadata?: { timestamp: string } }[]): string {
  if (relationships.length === 0) return ""
  const lines = [`Relationship memories (${relationships.length}):`]
  for (const rel of relationships) {
    if (rel.metadata) {
      lines.push(`  - ${rel.metadata.timestamp} (score: ${rel.score.toFixed(2)})`)
    }
  }
  return lines.join("\n")
}

function formatKnowledgeSection(
  knowledge: { category: string; key: string; value: unknown }[],
  maxSemantic: number
): string {
  if (knowledge.length === 0) return ""
  const sliced = knowledge.slice(0, maxSemantic)
  const lines = [`Known context (${Math.min(knowledge.length, maxSemantic)}):`]
  for (const k of sliced) {
    lines.push(`  - [${k.category}] ${k.key}: ${JSON.stringify(k.value)}`)
  }
  return lines.join("\n")
}

function formatGoalSection(
  goals: { status: string | null; title: string; priority: number | null; description?: string | null }[]
): string {
  if (goals.length === 0) return ""
  const lines = [`Active goals (${goals.length}):`]
  for (const goal of goals) {
    lines.push(
      `  - [${goal.status ?? "open"}] ${goal.title} (priority: ${goal.priority ?? 0.5})${goal.description ? ` — ${goal.description}` : ""}`
    )
  }
  return lines.join("\n")
}

function formatMessageSection(messages: PendingMessage[]): string {
  if (messages.length === 0) return ""
  const lines = ["New messages to respond to:"]
  for (const msg of messages) {
    lines.push(`[${msg.from}]: ${msg.text}`)
  }
  return lines.join("\n")
}

/**
 * Build full context for Sonnet complex-tier responses.
 * Includes personality prompt, emotion, perception, conversation history, last tick,
 * episodic memories (including relationship history), semantic knowledge,
 * all active goals, and pending messages.
 */
export async function buildComplexContext(messages: PendingMessage[], personalityPrompt?: string): Promise<string> {
  const queryText = messages.length > 0 ? messages.map((m) => m.text).join(" ") : "current tasks and goals"

  const config = TIERS.complex
  const [
    lastTick,
    episodes,
    knowledgeResult,
    conversationHistory,
    emotion,
    perception,
    relationships,
    operatorLanguage
  ] = await Promise.all([
    getLastTickSummary(),
    queryRelated(queryText, config.maxEpisodes),
    getKnowledge(),
    getConversationHistory(),
    getCurrentEmotion(),
    getPerceptionSummary(),
    queryRelationshipHistory(config.maxRelationship),
    getOperatorLanguage()
  ])
  const recentKnowledge = knowledgeResult.unwrapOr([])

  const allGoals = await getGoalsByPriority(config.maxGoals, emotion ?? undefined)

  const sections: string[] = [
    `Current time: ${formatISO(new Date())}`,
    `Operator's preferred language: ${operatorLanguage}`,
    personalityPrompt ?? "",
    emotion ? `Emotional state: ${formatEmotionSummary(emotion)}` : "",
    perception ? formatPerceptionBlock(perception) : "",
    formatConversationHistory(conversationHistory),
    lastTick ? `Previous tick: ${lastTick.triageDecision} — ${lastTick.triageReason}` : "",
    formatEpisodeSection(episodes),
    formatRelationshipSection(relationships),
    formatKnowledgeSection(recentKnowledge, config.maxSemantic),
    formatGoalSection(allGoals),
    formatMessageSection(messages)
  ].filter(Boolean)

  return sections.join("\n\n")
}

/**
 * Build maximum context for Opus deep-tier responses.
 * Includes everything from complex plus emotion history, trust levels,
 * and full personality DNA (base + adaptive separately).
 */
export async function buildDeepContext(messages: PendingMessage[], personalityPrompt?: string): Promise<string> {
  const complexContext = await buildComplexContext(messages, personalityPrompt)

  const deepConfig = TIERS.deep
  const [emotionHist, trustLvls, dna] = await Promise.all([
    getEmotionHistory(deepConfig.maxEmotionHistory),
    getAllTrustLevels(),
    loadPersonalityDna()
  ])

  const extraParts: string[] = []

  if (emotionHist.length > 0) {
    extraParts.push(`Emotion trajectory (last ${emotionHist.length}):`)
    for (const entry of emotionHist) {
      extraParts.push(`  - [${entry.trigger ?? "unknown"}] at ${entry.createdAt?.toISOString() ?? "?"}`)
    }
    extraParts.push("")
  }

  if (trustLvls.length > 0) {
    extraParts.push(`Trust levels (${trustLvls.length} actions):`)
    for (const t of trustLvls) {
      extraParts.push(
        `  - ${t.actionType}: fear=${(t.fear ?? 0).toFixed(2)}, confidence=${(t.confidence ?? 0).toFixed(2)}, attempts=${t.totalAttempts ?? 0}`
      )
    }
    extraParts.push("")
  }

  if (dna) {
    extraParts.push("Personality DNA:")
    extraParts.push(`  Base: ${JSON.stringify(dna.base)}`)
    extraParts.push(`  Adaptive: ${JSON.stringify(dna.adaptive)}`)
    extraParts.push("")
  }

  if (extraParts.length === 0) return complexContext

  return `${complexContext}\n\n${extraParts.join("\n")}`
}
