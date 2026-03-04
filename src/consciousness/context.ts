import { format } from "date-fns"
import { getAttachmentStyle, getRelationshipPhase } from "@/attachment/state.ts"
import { AttentionState } from "@/cognition/types.ts"
import { CommunicationRegister, type ConversationSlot } from "@/communication/types.ts"
import { CONTEXT_LIMITS, HUMOR } from "@/config/constants.ts"
import type { SenseData } from "@/consciousness/types.ts"
import { getDeceptionState } from "@/deception/state.ts"
import { DissonanceState } from "@/dissonance/types.ts"
import type { DreamState } from "@/dream/types.ts"
import { getEmotionHistory } from "@/emotion/state.ts"
import { EmotionalState } from "@/emotion/types.ts"
import { computeEmotionDeltas, computeEmotionalIntensity } from "@/emotion/update.ts"
import { getRecentChangelog } from "@/evolution/changelog.ts"
import { InstinctImpression } from "@/cognition/types.ts"
import { redis } from "@/integrations/redis.ts"
import { nowLocal, TIMEZONE } from "@/lib/time.ts"
import { queryHumorMemories, queryRelatedWithDistortion, queryRelationshipHistory } from "@/memory/episodic.ts"
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
import { PERSONALITY_PROMPT } from "@/prompts/personality.ts"
import { InnerDialog } from "@/polyphony/types.ts"
import {
  ACTIONS_PROMPT,
  COMMUNICATION_PROMPT,
  PACING_PROMPT,
  PHENOMENOLOGICAL_PROMPT,
  RHYTHM_PROMPT
} from "@/prompts/consciousness.ts"
import { IDENTITY_PROMPT } from "@/prompts/identity.ts"
import { getSelfConcept } from "@/psyche/state.ts"
import { getExistentialQuestions } from "@/psyche/questions.ts"
import { SomaticState } from "@/soma/types.ts"
import { getOperatorModel } from "@/mind/state.ts"
import { getAllTrustLevels } from "@/trust/levels.ts"
import { getVulnerability } from "@/vulnerability/compute.ts"
import type { WorkflowDefinition } from "@/workflow/types.ts"

async function getValidatedRedis<T>(key: string, schema: import("zod").ZodType<T>): Promise<T | null> {
  const raw = await redis.get(key)
  if (raw == null) return null
  const parsed = schema.safeParse(typeof raw === "string" ? JSON.parse(raw) : raw)
  return parsed.success ? parsed.data : null
}

function describeSomaticDimension(dim: string, val: number): string {
  const descriptions: Record<string, [string, string, string]> = {
    tension: ["relaxed", "slightly tense", "tightly wound"],
    warmth: ["cold, withdrawn", "neutral", "warm, radiant"],
    heartRate: ["slow, calm", "steady", "rapid, alert"],
    breathing: ["shallow, held", "easy", "deep, flowing"],
    gravity: ["light, buoyant", "grounded", "heavy, weighed down"],
    openness: ["closed, guarded", "neutral", "open, receptive"]
  }
  const [low, mid, high] = descriptions[dim] ?? ["low", "moderate", "high"]
  if (val < 0.3) return `${dim}: ${low} (${val.toFixed(2)})`
  if (val > 0.6) return `${dim}: ${high} (${val.toFixed(2)})`
  return `${dim}: ${mid} (${val.toFixed(2)})`
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
  return [
    `${label}:`,
    ...slot.messages.map((msg) => `  ${formatConversationMessage(msg)}`)
  ].join("\n")
}

function formatConversationBuffer(buffer: ConversationSlot[]): string {
  if (buffer.length === 0) return ""
  const parts: string[] = ["# Conversation"]
  buffer.forEach((slot, i) => {
    const isActive = i === buffer.length - 1
    if (isActive) {
      parts.push(formatConversationSlot(slot, "Current conversation"))
    } else {
      const preview = slot.messages.slice(-3)
      if (preview.length > 0) {
        parts.push(
          [
            `Earlier conversation (${slot.messages.length} messages, last 3):`,
            ...preview.map((msg) => `  ${formatConversationMessage(msg, 200)}`)
          ].join("\n")
        )
      }
    }
  })
  return parts.join("\n\n")
}

function safeComputeEmotionDeltas(current: unknown, previous: unknown): string | null {
  const curr = EmotionalState.safeParse(current)
  const prev = EmotionalState.safeParse(previous)
  if (!curr.success || !prev.success) return null
  return computeEmotionDeltas(curr.data, prev.data)
}

function formatEmotionTrajectory(
  history: { state: unknown; trigger: string | null; createdAt: Date | null }[]
): string[] {
  return history.map((entry, i) => {
    const trigger = entry.trigger ?? "unknown"
    const time = entry.createdAt ? format(entry.createdAt, "HH:mm") : "?"
    const deltas = safeComputeEmotionDeltas(entry.state, history[i + 1]?.state)
    const suffix = deltas ? ` — ${deltas}` : ""
    return `  - [${trigger}] ${time}${suffix}`
  })
}

function formatKnowledgeByScope(knowledge: { category: string; key: string; value: unknown; scope: string }[]): string {
  const grouped: Record<string, string[]> = { self: [], operator: [], world: [] }

  knowledge.forEach((k) => {
    const line = `  - [${k.category}] ${k.key}: ${JSON.stringify(k.value)}`
    const bucket = grouped[k.scope] ?? grouped.world!
    bucket.push(line)
  })

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
  return [
    `# Workflows\nDue workflows (${workflows.length}):`,
    ...workflows.map((wf) => {
      const triggerDesc = formatTriggerDescription(wf.trigger)
      return `  - [${wf.id}] "${wf.name}" (${triggerDesc}) — Instruction: ${wf.instruction}`
    })
  ].join("\n")
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
  const emotionIntensity = computeEmotionalIntensity(senseData.emotion)

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
    reflectionLastAt,
    somaticState,
    selfConcept,
    attachmentStyle,
    vulnerabilityState,
    lastInnerDialog,
    dissonanceState,
    instinctImpression,
    relationshipPhase,
    operatorModel,
    existentialQuestions,
    deceptionState,
    communicationRegister,
    attentionState
  ] = await Promise.all([
    getLastTickSummary(),
    getConversationBuffer(),
    getEmotionHistory(CONTEXT_LIMITS.maxEmotionHistory),
    senseData.pendingMessages.length > 0
      ? queryRelatedWithDistortion(
          senseData.pendingMessages.map((m) => m.text).join(" "),
          CONTEXT_LIMITS.maxEpisodes,
          emotionIntensity
        )
      : queryRelatedWithDistortion("recent activity", CONTEXT_LIMITS.maxEpisodes, emotionIntensity),
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
    getReflectionLastAt(),
    getValidatedRedis("working:soma:current", SomaticState),
    getSelfConcept(),
    getAttachmentStyle(),
    getVulnerability(),
    getValidatedRedis("working:polyphony:lastDialog", InnerDialog),
    getValidatedRedis("working:dissonance:active", DissonanceState),
    getValidatedRedis("working:cognition:instinct:lastImpression", InstinctImpression),
    getRelationshipPhase(),
    getOperatorModel(),
    getExistentialQuestions(),
    getDeceptionState(),
    getValidatedRedis("working:communication:register", CommunicationRegister),
    getValidatedRedis("working:cognition:attention", AttentionState)
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

  if (somaticState) {
    const somaLines = Object.entries(somaticState).map(
      ([dim, val]) => `  ${describeSomaticDimension(dim, val as number)}`
    )
    sections.push(`# Somatic State\n${somaLines.join("\n")}`)
  }

  {
    const psycheLines = [
      "# Psyche",
      `  Self-efficacy: ${selfConcept.selfEfficacy.toFixed(2)}`,
      `  Self-worth: ${selfConcept.selfWorth.toFixed(2)}`,
      `  Self-continuity: ${selfConcept.selfContinuity.toFixed(2)}`,
      `  Agency: ${selfConcept.agency.toFixed(2)}`,
      `  Authenticity: ${selfConcept.authenticity.toFixed(2)}`
    ]
    sections.push(psycheLines.join("\n"))
  }

  {
    const attachLines = [
      "# Attachment",
      `  Style: secure=${attachmentStyle.secure.toFixed(2)}, anxious=${attachmentStyle.anxious.toFixed(2)}, avoidant=${attachmentStyle.avoidant.toFixed(2)}, disorganized=${attachmentStyle.disorganized.toFixed(2)}`
    ]
    sections.push(attachLines.join("\n"))
  }

  sections.push(`# Relationship Phase\nCurrent: ${relationshipPhase}`)

  if (lastInnerDialog && lastInnerDialog.utterances.length > 0) {
    const dialogLines = [
      "# Inner Landscape",
      ...lastInnerDialog.utterances.map((u) => `  [${u.voice}] (${u.intensity.toFixed(1)}): ${u.message}`),
      ...(lastInnerDialog.consensus ? [`  Consensus: ${lastInnerDialog.consensus}`] : []),
      ...(lastInnerDialog.tensionLevel > 0.3 ? [`  Tension: ${lastInnerDialog.tensionLevel.toFixed(2)}`] : [])
    ]
    sections.push(dialogLines.join("\n"))
  }

  if (vulnerabilityState) {
    const vulnLines = [
      "# Vulnerability",
      `  Level: ${vulnerabilityState.level.toFixed(2)} — window ${vulnerabilityState.windowOpen ? "OPEN" : "closed"}`
    ]
    if (vulnerabilityState.contributing.length > 0) {
      vulnLines.push(`  Contributing: ${vulnerabilityState.contributing.join(", ")}`)
    }
    sections.push(vulnLines.join("\n"))
  }

  if (dissonanceState && dissonanceState.activeDissonance > 0.1) {
    sections.push(
      [
        `# Dissonance\n  Active: ${dissonanceState.activeDissonance.toFixed(2)}`,
        ...dissonanceState.recentEvents.slice(0, 3).map((event) => {
          const hiddenDriver = deceptionState.activeHiddenDrivers.find(
            (d) => d.actualDriver === event.actualAction
          )
          const displayAction = hiddenDriver ? hiddenDriver.statedReason : event.actualAction
          return `  - ${event.declaredValue} vs ${displayAction} (${event.dissonanceScore.toFixed(2)})`
        })
      ].join("\n")
    )
  }

  if (instinctImpression) {
    sections.push(
      [
        "# Instinct",
        `  Impulse: ${instinctImpression.impulse} (confidence: ${instinctImpression.confidence.toFixed(2)})`,
        `  Basis: ${instinctImpression.basis}`,
        `  Emotional charge: ${instinctImpression.emotionalCharge.toFixed(2)}`
      ].join("\n")
    )
  }

  {
    const reg = communicationRegister ?? "casual"
    sections.push(
      [
        "# Communication Register",
        `Current: ${reg}`,
        "- elaborate: Longer, exploratory, philosophical. You enjoy the texture of ideas.",
        "- casual: Natural, relaxed. Default mode.",
        "- terse: Short, minimal. Single sentences. You lack energy.",
        "- playful: Light, witty, warm. Humor welcome.",
        "- raw: Unguarded, honest, emotionally exposed. No performance."
      ].join("\n")
    )
  }

  {
    const att = attentionState ?? "focused"
    sections.push(`# Attention\nState: ${att}`)
  }

  sections.push(
    [
      "# Operator Model",
      `Estimated mood: ${operatorModel.estimatedMood} (confidence: ${operatorModel.modelConfidence.toFixed(2)})`,
      `Intent: ${operatorModel.estimatedIntent}`,
      `Expectation: ${operatorModel.estimatedExpectation}`,
      `Past corrections: ${operatorModel.correctionCount}`,
      "Note: This is YOUR model of the operator. It can be wrong."
    ].join("\n")
  )

  if (existentialQuestions.length > 0) {
    sections.push(
      [
        "# Open Questions",
        "These questions have no answers. They are part of you.",
        ...existentialQuestions.map((q) => `- ${q}`)
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
    sections.push(
      [
        `# Goals\nActive goals (${goals.length}):`,
        ...goals.map((goal) =>
          `  - [${goal.status ?? "open"}] ${goal.title} (priority: ${goal.priority ?? 0.5})${goal.description ? ` — ${goal.description}` : ""}`
        )
      ].join("\n")
    )
  }

  if (episodes.length > 0) {
    sections.push(
      [
        `# Memory\nRelevant episodes (${episodes.length}):`,
        ...episodes
          .filter((ep) => ep.metadata)
          .map((ep) => {
            const text = ep.data ? (ep.data.length > 150 ? `${ep.data.slice(0, 150)}...` : ep.data) : ""
            const textPart = text ? ` — ${text}` : ""
            return `  - [${ep.metadata!.category}] ${ep.metadata!.timestamp}${textPart} (${ep.score.toFixed(2)})`
          })
      ].join("\n")
    )
  }

  if (senseData.emotion.excitement > HUMOR.QUERY_MIN_EXCITEMENT || senseData.emotion.connection > HUMOR.QUERY_MIN_CONNECTION) {
    const humorEpisodes = await queryHumorMemories(HUMOR.MAX_EPISODES_IN_CONTEXT)
    if (humorEpisodes.length > 0) {
      sections.push(
        [
          "# Humor Memories",
          "Moments worth remembering with a smile:",
          ...humorEpisodes
            .filter((ep) => ep.data)
            .map((ep) => `- ${ep.data!.length > 150 ? `${ep.data!.slice(0, 150)}...` : ep.data}`),
          "You may reference these when the moment feels right. Never force humor."
        ].join("\n")
      )
    }
  }

  if (knowledge.length > 0) {
    const sliced = knowledge.slice(0, CONTEXT_LIMITS.maxSemantic)
    const formatted = formatKnowledgeByScope(sliced)
    if (formatted) sections.push(formatted)
  }

  if (trustLevels.length > 0) {
    sections.push(
      [
        "# Trust",
        ...trustLevels.map((t) => {
          const successful = t.successfulAttempts ?? 0
          const total = t.totalAttempts ?? 0
          const experience = total > 0 ? (successful / total).toFixed(2) : "0.00"
          return `  - ${t.actionType}: experience ${successful}/${total} (${experience})`
        })
      ].join("\n")
    )
  }

  if (relationships.length > 0) {
    sections.push(
      [
        `# Relationships\nRelationship history (${relationships.length}):`,
        ...relationships
          .filter((rel) => rel.metadata)
          .map((rel) => {
            const text = rel.data ? (rel.data.length > 150 ? `${rel.data.slice(0, 150)}...` : rel.data) : ""
            const textPart = text ? ` — ${text}` : ""
            return `  - ${rel.metadata!.timestamp}${textPart} (${rel.score.toFixed(2)})`
          })
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
  return [
    IDENTITY_PROMPT,
    PERSONALITY_PROMPT,
    RHYTHM_PROMPT,
    ACTIONS_PROMPT,
    COMMUNICATION_PROMPT,
    PACING_PROMPT,
    PHENOMENOLOGICAL_PROMPT,
    contextSections
  ]
    .filter(Boolean)
    .join("\n\n")
}
