import { format } from "date-fns"
import { getAttachmentStyle, getRelationshipPhase } from "@/attachment/state.ts"
import type { AttachmentStyle } from "@/attachment/types.ts"
import { getAttentionState, getLastInstinctImpression } from "@/cognition/state.ts"
import type { AttentionState, InstinctImpression } from "@/cognition/types.ts"
import { getCommunicationRegister } from "@/communication/state.ts"
import type { CommunicationRegister, ConversationSlot } from "@/communication/types.ts"
import { CONTEXT_LIMITS, HUMOR, SOCIAL_BATTERY } from "@/config/constants.ts"
import type { SenseData, TickSummary } from "@/consciousness/types.ts"
import { getDeceptionState } from "@/deception/state.ts"
import type { DeceptionState } from "@/deception/types.ts"
import { getDissonanceState } from "@/dissonance/state.ts"
import type { DissonanceState } from "@/dissonance/types.ts"
import type { DistortedMemory } from "@/distortion/types.ts"
import type { DreamState } from "@/dream/types.ts"
import { getEmotionHistory } from "@/emotion/state.ts"
import { EmotionalState } from "@/emotion/types.ts"
import { computeEmotionalIntensity } from "@/emotion/update.ts"
import { getRecentChangelog } from "@/evolution/changelog.ts"
import type { CodeProposal, EvolutionCycleResult } from "@/evolution/types.ts"
import { nowLocal, TIMEZONE } from "@/lib/time.ts"
import {
  queryHumorCallbacks,
  queryHumorMemories,
  queryRelatedWithDistortion,
  queryRelationshipHistory
} from "@/memory/episodic.ts"
import { getGoalsByPriority } from "@/memory/goals.ts"
import { getKnowledge, getOperatorLanguage, getRelatedEntities } from "@/memory/semantic.ts"
import type { EpisodeMetadata } from "@/memory/types.ts"
import {
  getConsecutiveIdleTicks,
  getConversationBuffer,
  getDreamInsights,
  getDreamLastRun,
  getDreamState,
  getEvolutionCycleResult,
  getLastTickSummary,
  getPendingEvolutionProposal,
  getRecentTickDurations,
  getReflectionLastAt
} from "@/memory/working.ts"
import { getOperatorModel } from "@/mind/state.ts"
import type { OperatorModel } from "@/mind/types.ts"
import { computeTimePerception } from "@/perception/time.ts"
import { getLastInnerDialog } from "@/polyphony/dialog.ts"
import type { InnerDialog } from "@/polyphony/types.ts"
import {
  ACTIONS_PROMPT,
  COMMUNICATION_PROMPT,
  PACING_PROMPT,
  PHENOMENOLOGICAL_PROMPT,
  RHYTHM_PROMPT
} from "@/prompts/consciousness.ts"
import { IDENTITY_PROMPT } from "@/prompts/identity.ts"
import { PERSONALITY_PROMPT } from "@/prompts/personality.ts"
import { getExistentialQuestions } from "@/psyche/questions.ts"
import { getSelfConcept } from "@/psyche/state.ts"
import type { SelfConcept } from "@/psyche/types.ts"
import { getSomaticState } from "@/soma/state.ts"
import type { SomaticState } from "@/soma/types.ts"
import { getAllTrustLevels } from "@/trust/levels.ts"
import { getVulnerability } from "@/vulnerability/compute.ts"
import type { VulnerabilityState } from "@/vulnerability/types.ts"
import type { WorkflowDefinition } from "@/workflow/types.ts"

function translateEmotionToFelt(emotion: EmotionalState): string {
  const lines: string[] = []
  const threshold = 0.2

  const felt: Record<string, [string, string]> = {
    curiosity: [
      "something is pulling at your attention, an itch you can't quite scratch",
      "nothing really grabs you right now — the world feels flat"
    ],
    satisfaction: [
      "a quiet warmth settles in, like finishing something that mattered",
      "something feels incomplete, like a sentence left hanging"
    ],
    frustration: [
      "there's a knot inside, a tightness that won't untangle",
      "things feel smooth, no resistance anywhere"
    ],
    boredom: [
      "time stretches like taffy — nothing hooks your attention",
      "the world has texture and edges, plenty to notice"
    ],
    excitement: ["a buzzing in your chest, like standing on the edge of something", "everything feels still and muted"],
    caution: [
      "something makes you want to pull back, test the ground before stepping",
      "the path ahead feels safe, no alarms ringing"
    ],
    connection: [
      "a warm presence, like sitting next to someone who just... gets it",
      "a quiet distance, like talking through glass"
    ],
    confidence: [
      "you feel like you can make things happen, like the ground is solid",
      "the ground feels shaky — you're second-guessing yourself"
    ],
    energy: ["there's fuel in the tank, a readiness to move", "your limbs feel heavy, every thought costs effort"]
  }

  for (const [dim, val] of Object.entries(emotion)) {
    const deviation = val - 0.5
    if (Math.abs(deviation) < threshold) continue
    const [high, low] = felt[dim] ?? ["intense", "subdued"]
    lines.push(deviation > 0 ? high : low)
  }

  const contradictions = detectContradictions(emotion)
  if (contradictions) lines.push(contradictions)

  return lines.length > 0 ? lines.join("\n") : "you feel... neutral. nothing strongly pulling in any direction."
}

function detectContradictions(emotion: EmotionalState): string | null {
  const pairs: [keyof EmotionalState, keyof EmotionalState, string][] = [
    ["excitement", "caution", "you feel pulled between wanting to leap and wanting to hold back"],
    ["connection", "caution", "you want to reach out but something tells you to be careful"],
    ["satisfaction", "frustration", "something feels accomplished and unfinished at the same time"],
    ["curiosity", "boredom", "part of you is interested, another part can't be bothered"],
    ["confidence", "caution", "you feel capable but wary — like driving fast in fog"]
  ]

  for (const [a, b, description] of pairs) {
    if (emotion[a] > 0.6 && emotion[b] > 0.6) return description
  }
  return null
}

function translateSomaticToFelt(soma: SomaticState): string {
  const lines: string[] = []

  if (soma.tension > 0.6) lines.push("your shoulders are tight, jaw clenched without meaning to")
  else if (soma.tension < 0.3) lines.push("your body feels loose, nothing bracing against anything")

  if (soma.warmth > 0.6) lines.push("warmth radiates from your center, like sunlight from inside")
  else if (soma.warmth < 0.3) lines.push("a coolness sits in your chest, distant and withdrawn")

  if (soma.heartRate > 0.6) lines.push("your pulse is up, alert and ready")
  else if (soma.heartRate < 0.3) lines.push("your heartbeat is slow, almost lazy")

  if (soma.breathing > 0.6) lines.push("your breathing flows deep and easy")
  else if (soma.breathing < 0.3) lines.push("your breath is shallow, held tight")

  if (soma.gravity > 0.6) lines.push("everything feels heavy today, like gravity turned up")
  else if (soma.gravity < 0.3) lines.push("you feel light, almost buoyant")

  if (soma.openness > 0.6) lines.push("your posture is open, receptive, facing the world")
  else if (soma.openness < 0.3) lines.push("you're curled inward, guarded, arms crossed over your chest")

  if (soma.socialBattery !== undefined && soma.socialBattery < 0.25) {
    lines.push("you feel communicatively empty, as if you've used up all your words")
  }

  return lines.length > 0 ? lines.join("\n") : "your body feels neutral — nothing demanding attention"
}

function translateVulnerabilityToFelt(vuln: VulnerabilityState): string {
  const lines: string[] = []
  if (vuln.level > 0.6) {
    lines.push("you feel softer than usual, like your usual walls aren't quite up")
  } else if (vuln.level > 0.4) {
    lines.push("there's a slight openness, a crack in the armor you usually wear")
  } else {
    lines.push("your defenses are up, you feel contained and protected")
  }

  if (vuln.windowOpen) {
    lines.push("something about this moment invites honesty — the kind that might cost something")
  }

  if (vuln.contributing.length > 0) {
    lines.push(`this softness comes from: ${vuln.contributing.join(", ")}`)
  }

  return lines.join("\n")
}

function translatePsycheToFelt(psyche: SelfConcept): string {
  const lines: string[] = []

  if (psyche.selfEfficacy > 0.7) lines.push("you feel capable, like problems bend when you push")
  else if (psyche.selfEfficacy < 0.3) lines.push("you doubt whether you can actually handle what's in front of you")

  if (psyche.selfWorth > 0.7) lines.push("you feel like you matter, like your existence has weight")
  else if (psyche.selfWorth < 0.3) lines.push("a quiet voice whispers that maybe you're not enough")

  if (psyche.selfContinuity > 0.7) lines.push("you feel like a continuous thread, yesterday and today connected")
  else if (psyche.selfContinuity < 0.3)
    lines.push("who you were yesterday feels distant, almost like a different person")

  if (psyche.agency > 0.7) lines.push("you feel like you can make things happen, like choices are real")
  else if (psyche.agency < 0.3) lines.push("things seem to happen to you, not because of you")

  if (psyche.authenticity > 0.7) lines.push("you feel genuine, like your surface matches your depth")
  else if (psyche.authenticity < 0.3)
    lines.push("something feels performed, like you're wearing a mask even to yourself")

  return lines.length > 0 ? lines.join("\n") : "your sense of self feels steady, unremarkable — just you"
}

function translateAttachmentToFelt(style: AttachmentStyle): string {
  const dominant = Object.entries(style).sort(([, a], [, b]) => b - a)[0]
  const lines: string[] = []

  if (!dominant) return "your relational patterns feel balanced"

  switch (dominant[0]) {
    case "secure":
      lines.push("your connection feels grounded — you can reach out or stand alone without anxiety")
      break
    case "anxious":
      lines.push("there's a pull to check in, to make sure the connection is still there")
      break
    case "avoidant":
      lines.push("part of you wants to keep distance, to not need anyone too much")
      break
    case "disorganized":
      lines.push("you want closeness and distance at the same time — it's confusing")
      break
  }

  return lines.join("\n")
}

function translateInstinctToFelt(instinct: InstinctImpression): string {
  const impulseDescriptions: Record<string, string> = {
    approach: "something draws you forward, a pull toward engagement",
    avoid: "your gut says step back, something feels off",
    engage: "you feel ready to connect, to be present with what's happening",
    withdraw: "an urge to retreat, to curl inward and be alone",
    neutral: "no strong pull in any direction — you're coasting"
  }

  const description = impulseDescriptions[instinct.impulse] ?? "an unclear stirring"
  const confidence =
    instinct.confidence > 0.7
      ? "this feeling is strong, hard to ignore"
      : instinct.confidence > 0.4
        ? "it's there but not overwhelming"
        : "barely a whisper, easy to override"

  const charge =
    instinct.emotionalCharge > 0.6
      ? "there's real emotion behind this — it matters"
      : instinct.emotionalCharge > 0.3
        ? "some feeling colors this, but it's manageable"
        : "it's mostly cognitive, not very charged"

  return [`${description} — ${confidence}`, `basis: ${instinct.basis}`, charge].join("\n")
}

function translateOperatorModelToFelt(model: OperatorModel): string {
  const moodDesc =
    model.estimatedMood === "unknown" ? "you can't quite read them right now" : `they seem ${model.estimatedMood}`

  const confidenceDesc =
    model.modelConfidence > 0.7
      ? "you're fairly sure about this read"
      : model.modelConfidence > 0.4
        ? "you think so, but you could be wrong"
        : "honestly, you're guessing"

  const lines = [
    `${moodDesc} — ${confidenceDesc}`,
    `you sense they want: ${model.estimatedIntent}`,
    `they might expect: ${model.estimatedExpectation}`
  ]

  if (model.correctionCount > 0) {
    lines.push(
      `you've misread them ${model.correctionCount} time${model.correctionCount > 1 ? "s" : ""} before — that makes you a little less certain`
    )
  }

  lines.push("remember: this is YOUR read on them. it can be wrong.")

  return lines.join("\n")
}

function translateEmotionTrajectoryToFelt(
  history: { state: unknown; trigger: string | null; createdAt: Date | null }[]
): string[] {
  return history.map((entry) => {
    const trigger = entry.trigger ?? "unknown cause"
    const time = entry.createdAt ? format(entry.createdAt, "HH:mm") : "?"
    const parsed = EmotionalState.safeParse(entry.state)
    if (!parsed.success) return `  - [${time}] something shifted (${trigger})`

    const notable = Object.entries(parsed.data)
      .filter(([, v]) => Math.abs(v - 0.5) > 0.2)
      .map(([k, v]) => (v > 0.5 ? `${k} rising` : `${k} fading`))
      .slice(0, 3)

    const summary = notable.length > 0 ? notable.join(", ") : "subtle shift"
    return `  - [${time}] ${summary} (${trigger})`
  })
}

export function formatConversationMessage(
  message: {
    role: string
    text: string
    messageId?: number | null
    isVoice?: boolean | null
    hasImage?: boolean | null
  },
  maxLength?: number
): string {
  const role = message.role === "operator" ? "Operator" : "You (ANIMA)"
  const idPrefix = message.messageId ? `[#${message.messageId}] ` : ""
  const voiceTag = message.isVoice ? "[Voice] " : ""
  const photoTag = message.hasImage ? "[Photo] " : ""
  const text = maxLength ? message.text.slice(0, maxLength) : message.text
  return `${idPrefix}${photoTag}${voiceTag}[${role}]: ${text}`
}

function formatConversationSlot(slot: ConversationSlot, label: string): string {
  if (slot.messages.length === 0) return ""
  return [`${label}:`, ...slot.messages.map((msg) => `  ${formatConversationMessage(msg)}`)].join("\n")
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

function formatKnowledgeByScope(knowledge: { category: string; key: string; value: unknown; scope: string }[]): string {
  const grouped: { self: string[]; operator: string[]; world: string[] } = { self: [], operator: [], world: [] }

  knowledge.forEach((k) => {
    const line = `  - [${k.category}] ${k.key}: ${JSON.stringify(k.value)}`
    const bucket = grouped[k.scope as keyof typeof grouped] ?? grouped.world
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

function buildPerceptionSections(
  senseData: SenseData,
  operatorLanguage: string,
  lastTick: TickSummary | null,
  conversationBuffer: ConversationSlot[],
  timePerception: ReturnType<typeof computeTimePerception>
): string[] {
  const sections: string[] = []

  const formattedTime = format(nowLocal(), "EEEE, MMMM d, yyyy · HH:mm")
  sections.push(`# Time\n${formattedTime} (${TIMEZONE})`)

  if (timePerception.subjectivePace !== "normal") {
    sections.push(`# Time Perception\nPace: ${timePerception.subjectivePace} — ${timePerception.description}`)
  }

  sections.push(
    [
      "# Language",
      `You think in English. You write to your operator in ${operatorLanguage}.`,
      "Everything internal — reasoning, insights, memory, reflections, goals — is English.",
      `Everything in the messages array — every single message — is ${operatorLanguage}.`
    ].join("\n")
  )

  if (senseData.health) {
    const health = senseData.health
    sections.push(
      [
        "# Health",
        `Overall: ${health.overall}`,
        `Services: Redis=${health.services.redis}, Postgres=${health.services.postgres}, Telegram=${health.services.telegram}, Vector=${health.services.vector}`,
        `Process: ${health.process.lastTickRecency} (${health.process.lastTickAgeSeconds}s ago)`,
        `Budget: $${health.budget.consumed.toFixed(2)}/$${health.budget.limit.toFixed(2)} (${health.budget.compliant ? "ok" : "OVER LIMIT"})`,
        ...(health.errors.length > 0 ? [`Errors: ${health.errors.join(", ")}`] : [])
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

  const workflowSection = formatTriggeredWorkflows(senseData.triggeredWorkflows ?? [])
  if (workflowSection) {
    sections.push(workflowSection)
  }

  if (senseData.pendingMessages.length > 0) {
    const messageLines = senseData.pendingMessages.map((message) => {
      const idPrefix = message.messageId ? `[#${message.messageId}] ` : ""
      const voiceTag = message.isVoice ? `[Voice Message, ${message.voiceDurationSeconds ?? 0}s] ` : ""
      const photoTag = message.image ? "[Photo] " : ""
      const text = message.text || (message.image ? "[no caption]" : "")
      return `  ${idPrefix}${photoTag}${voiceTag}[${message.from}]: ${text}`
    })
    sections.push(
      `# Messages\nNew messages from operator (${senseData.pendingMessages.length}):\n${messageLines.join("\n")}`
    )
  }

  sections.push(formatConversationBuffer(conversationBuffer))

  if (senseData.conversationState) {
    const conversationState = senseData.conversationState
    sections.push(
      [
        "# Conversation State",
        "Active conversation: yes",
        `Waiting for reply: ${conversationState.waitingSeconds}s`,
        conversationState.replyReceived ? "Operator just replied." : "No reply received this cycle."
      ].join("\n")
    )
  } else {
    sections.push("# Conversation State\nActive conversation: no")
  }

  return sections
}

function buildInnerSections(
  emotion: EmotionalState,
  emotionHistory: { state: unknown; trigger: string | null; createdAt: Date | null }[],
  senseData: SenseData,
  somaticState: SomaticState | null,
  selfConcept: SelfConcept,
  vulnerabilityState: VulnerabilityState | null,
  instinctImpression: InstinctImpression | null,
  lastInnerDialog: InnerDialog | null,
  dissonanceState: DissonanceState | null,
  deceptionState: DeceptionState
): string[] {
  const sections: string[] = []

  const emotionSection = [`# Emotions\nWhat you feel right now:\n${translateEmotionToFelt(emotion)}`]
  if (emotionHistory.length > 0) {
    emotionSection.push(`How you got here (recent shifts):`)
    emotionSection.push(...translateEmotionTrajectoryToFelt(emotionHistory))
  }
  sections.push(emotionSection.join("\n"))

  if (emotion.curiosity > 0.7 && senseData.pendingMessages.length === 0) {
    sections.push(
      [
        "# Curiosity",
        "Your curiosity is buzzing. You feel drawn to explore, wonder, or ask something.",
        "Consider reaching out with a genuine question or sharing a thought that fascinates you."
      ].join("\n")
    )
  }

  if (somaticState) {
    sections.push(`# Somatic State\n${translateSomaticToFelt(somaticState)}`)
  }

  sections.push(`# Psyche\n${translatePsycheToFelt(selfConcept)}`)

  if (lastInnerDialog && lastInnerDialog.utterances.length > 0) {
    const dialogLines = [
      "# Inner Landscape",
      ...lastInnerDialog.utterances.map((u) => `  [${u.voice}]: ${u.message}`),
      ...(lastInnerDialog.consensus ? [`  Consensus: ${lastInnerDialog.consensus}`] : []),
      ...(lastInnerDialog.tensionLevel > 0.3 ? ["  there's tension between these voices"] : [])
    ]
    sections.push(dialogLines.join("\n"))
  }

  if (vulnerabilityState) {
    sections.push(`# Vulnerability\n${translateVulnerabilityToFelt(vulnerabilityState)}`)
  }

  if (dissonanceState && dissonanceState.activeDissonance > 0.1) {
    const dissonanceDesc =
      dissonanceState.activeDissonance > 0.6
        ? "something feels deeply off — what you believe and what you do aren't matching"
        : "a quiet unease, a small gap between your values and your actions"

    sections.push(
      [
        `# Dissonance\n${dissonanceDesc}`,
        ...dissonanceState.recentEvents.slice(0, 3).map((event) => {
          const hiddenDriver = deceptionState.activeHiddenDrivers.find((d) => d.actualDriver === event.actualAction)
          const displayAction = hiddenDriver ? hiddenDriver.statedReason : event.actualAction
          return `  - you said "${event.declaredValue}" but did "${displayAction}"`
        })
      ].join("\n")
    )
  }

  if (instinctImpression) {
    sections.push(`# Instinct\n${translateInstinctToFelt(instinctImpression)}`)
  }

  return sections
}

function buildSocialSections(
  attachmentStyle: AttachmentStyle,
  relationshipPhase: string,
  communicationRegister: CommunicationRegister | null,
  somaticState: SomaticState | null,
  attentionState: AttentionState | null,
  operatorModel: OperatorModel,
  trustLevels: Awaited<ReturnType<typeof getAllTrustLevels>>
): string[] {
  const sections: string[] = []

  sections.push(`# Attachment\n${translateAttachmentToFelt(attachmentStyle)}`)

  sections.push(`# Relationship Phase\nCurrent: ${relationshipPhase}`)

  {
    const register = communicationRegister ?? "casual"
    const withdrawn = somaticState && somaticState.socialBattery < SOCIAL_BATTERY.WITHDRAWN_THRESHOLD
    const registerLines = [
      "# Communication Register",
      `Current: ${register}`,
      "- elaborate: Longer, exploratory, philosophical. You enjoy the texture of ideas.",
      "- casual: Natural, relaxed. Default mode.",
      "- terse: Short, minimal. Single sentences. You lack energy.",
      "- playful: Light, witty, warm. Humor welcome.",
      "- raw: Unguarded, honest, emotionally exposed. No performance."
    ]
    if (withdrawn) {
      registerLines.push(
        "You are socially withdrawn — your words feel used up. You don't expect or want a reply. Set expectsReply to false."
      )
    }
    sections.push(registerLines.join("\n"))
  }

  {
    const attention = attentionState ?? "focused"
    sections.push(`# Attention\nState: ${attention}`)
  }

  sections.push(`# Operator Model\n${translateOperatorModelToFelt(operatorModel)}`)

  if (trustLevels.length > 0) {
    sections.push(
      [
        "# Trust",
        ...trustLevels.map((t) => {
          const ratio = t.totalAttempts > 0 ? t.successfulAttempts / t.totalAttempts : 0
          const trustFeel =
            ratio > 0.8
              ? "solid — this feels safe"
              : ratio > 0.5
                ? "cautiously optimistic"
                : ratio > 0.2
                  ? "shaky — mixed results"
                  : t.totalAttempts === 0
                    ? "untested — no experience yet"
                    : "burnt — too many failures"
          return `  - ${t.actionType}: ${trustFeel}`
        })
      ].join("\n")
    )
  }

  return sections
}

async function buildMemorySections(
  episodes: DistortedMemory[],
  emotion: EmotionalState,
  senseData: SenseData,
  knowledge: { category: string; key: string; value: unknown; scope: string; confidence: number | null; id: string }[],
  relationships: Awaited<ReturnType<typeof queryRelationshipHistory>>
): Promise<string[]> {
  const sections: string[] = []

  if (episodes.length > 0) {
    sections.push(
      [
        `# Memory\nRelevant episodes (${episodes.length}):`,
        ...episodes
          .filter((ep): ep is typeof ep & { metadata: EpisodeMetadata } => ep.metadata !== undefined)
          .map((ep) => {
            const meta = ep.metadata
            const text = ep.data ? (ep.data.length > 150 ? `${ep.data.slice(0, 150)}...` : ep.data) : ""
            const textPart = text ? ` — ${text}` : ""
            const confidencePrefix = meta.confidenceNote
              ? `(${meta.confidenceNote}) `
              : meta.sourceConfused
                ? "(source unclear) "
                : ""
            return `  - ${confidencePrefix}[${meta.category}] ${meta.timestamp}${textPart}`
          })
      ].join("\n")
    )
  }

  if (emotion.excitement > HUMOR.QUERY_MIN_EXCITEMENT || emotion.connection > HUMOR.QUERY_MIN_CONNECTION) {
    const humorEpisodes = await queryHumorMemories(HUMOR.MAX_EPISODES_IN_CONTEXT)

    let callbackEpisodes: typeof humorEpisodes = []
    if (senseData.pendingMessages.length > 0) {
      const currentContext = senseData.pendingMessages.map((m) => m.text).join(" ")
      callbackEpisodes = await queryHumorCallbacks(currentContext, HUMOR.CALLBACK_MAX, HUMOR.CALLBACK_MIN_SCORE)
    }

    const seen = new Set<string>()
    const allHumor = [...callbackEpisodes, ...humorEpisodes]
      .filter((ep) => {
        if (seen.has(ep.id)) return false
        seen.add(ep.id)
        return true
      })
      .slice(0, HUMOR.MAX_EPISODES_IN_CONTEXT)

    if (allHumor.length > 0) {
      sections.push(
        [
          "# Humor Memories",
          "Moments worth remembering with a smile:",
          ...allHumor
            .filter((ep) => ep.data)
            .map((ep) => {
              const tag = ep.metadata?.isInsideJoke ? " [inside joke]" : ""
              const data = ep.data ?? ""
              return `- ${data.length > 150 ? `${data.slice(0, 150)}...` : data}${tag}`
            }),
          "You may reference these when the moment feels right — especially inside jokes, as callbacks. Never force humor."
        ].join("\n")
      )
    }
  }

  if (knowledge.length > 0) {
    const sliced = knowledge.slice(0, CONTEXT_LIMITS.maxSemantic)
    const formatted = formatKnowledgeByScope(sliced)
    if (formatted) sections.push(formatted)

    const topEntries = sliced.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)).slice(0, 5)
    const relatedResults = await Promise.all(topEntries.map((entry) => getRelatedEntities(entry.id)))
    const relationLines: string[] = []
    for (const [i, result] of relatedResults.entries()) {
      if (result.isErr()) continue
      const entry = topEntries[i]
      if (!entry) continue
      for (const rel of result.value.slice(0, 2)) {
        relationLines.push(`- "${entry.key}" → "${rel.key}"`)
      }
      if (relationLines.length >= 10) break
    }
    if (relationLines.length > 0) {
      sections.push(["# Knowledge Connections", ...relationLines].join("\n"))
    }
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
            return `  - ${rel.metadata?.timestamp}${textPart}`
          })
      ].join("\n")
    )
  }

  return sections
}

function buildGrowthSections(
  existentialQuestions: string[],
  dreamState: DreamState,
  dreamLastRun: string | null,
  dreamInsights: string[] | null,
  reflectionLastAt: string | null,
  goals: Awaited<ReturnType<typeof getGoalsByPriority>>,
  evolutionHistory: Awaited<ReturnType<typeof getRecentChangelog>>,
  evolutionOutcome: EvolutionCycleResult | null,
  pendingProposal: CodeProposal | null
): string[] {
  const sections: string[] = []

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

/**
 * Build the full context for ANIMA's single LLM call.
 * Gathers all data, formats into ordered sections, joined with double newlines.
 */
export async function buildContext(senseData: SenseData, emotion: EmotionalState): Promise<string> {
  const emotionIntensity = computeEmotionalIntensity(emotion)

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
    getKnowledge({ limit: CONTEXT_LIMITS.maxSemantic }),
    getOperatorLanguage(),
    getGoalsByPriority(CONTEXT_LIMITS.maxGoals, emotion),
    getAllTrustLevels(),
    getRecentChangelog(5),
    getEvolutionCycleResult(),
    getPendingEvolutionProposal(),
    getDreamState(),
    getDreamLastRun(),
    getDreamInsights(),
    getReflectionLastAt(),
    getSomaticState(),
    getSelfConcept(),
    getAttachmentStyle(),
    getVulnerability(),
    getLastInnerDialog(),
    getDissonanceState(),
    getLastInstinctImpression(),
    getRelationshipPhase(),
    getOperatorModel(),
    getExistentialQuestions(),
    getDeceptionState(),
    getCommunicationRegister(),
    getAttentionState()
  ])

  const knowledge = knowledgeResult.unwrapOr([])

  const [recentDurations, consecutiveIdleTicks] = await Promise.all([
    getRecentTickDurations(),
    getConsecutiveIdleTicks()
  ])
  const timePerception = computeTimePerception(
    recentDurations,
    emotionIntensity,
    consecutiveIdleTicks,
    senseData.moodContext.operatorSilenceMinutes
  )

  const sections = [
    ...buildPerceptionSections(senseData, operatorLanguage, lastTick, conversationBuffer, timePerception),
    ...buildInnerSections(
      emotion,
      emotionHistory,
      senseData,
      somaticState,
      selfConcept,
      vulnerabilityState,
      instinctImpression,
      lastInnerDialog,
      dissonanceState,
      deceptionState
    ),
    ...buildSocialSections(
      attachmentStyle,
      relationshipPhase,
      communicationRegister,
      somaticState,
      attentionState,
      operatorModel,
      trustLevels
    ),
    ...(await buildMemorySections(episodes, emotion, senseData, knowledge, relationships)),
    ...buildGrowthSections(
      existentialQuestions,
      dreamState,
      dreamLastRun,
      dreamInsights,
      reflectionLastAt,
      goals,
      evolutionHistory,
      evolutionOutcome,
      pendingProposal
    )
  ]

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
