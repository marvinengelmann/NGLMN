import { format } from "date-fns"
import { getPhenomenologicalText, isExpired } from "@/altered/compute.ts"
import { getActiveAlteredState } from "@/altered/state.ts"
import { getAttachmentStyle, getRelationshipPhase } from "@/attachment/state.ts"
import type { AttachmentStyle } from "@/attachment/types.ts"
import { getProcrastinationState } from "@/cognition/procrastination/state.ts"
import type { ProcrastinationState } from "@/cognition/procrastination/types.ts"
import { getAttentionState, getLastInstinctImpression } from "@/cognition/state.ts"
import type { AttentionState, InstinctImpression } from "@/cognition/types.ts"
import { buildIdiolectSection } from "@/communication/idiolect/compute.ts"
import { getIdiolectState } from "@/communication/idiolect/state.ts"
import type { IdiolectState } from "@/communication/idiolect/types.ts"
import { computeSyntacticInstability } from "@/communication/instability.ts"
import { getCommunicationRegister } from "@/communication/state.ts"
import type { CommunicationRegister, ConversationSlot } from "@/communication/types.ts"
import { CALENDAR, CONTEXT_LIMITS, HUMOR, PERCEPTION, SOCIAL_BATTERY } from "@/config/constants.ts"
import type { SenseData, TickSummary } from "@/consciousness/types.ts"
import { getDeceptionState } from "@/deception/state.ts"
import type { DeceptionState } from "@/deception/types.ts"
import { getDissonanceState } from "@/dissonance/state.ts"
import type { DissonanceState } from "@/dissonance/types.ts"
import type { DistortedMemory } from "@/distortion/types.ts"
import type { DreamState } from "@/dream/types.ts"
import { DreamAfterglow } from "@/dream/types.ts"
import { type AmbivalenceState, getAmbivalenceState } from "@/emotion/ambivalence.ts"
import { getProtectiveAngerState, type ProtectiveAngerState } from "@/emotion/anger.ts"
import { type AnticipationState, getAnticipationState } from "@/emotion/anticipation.ts"
import { type AweState, getAweState } from "@/emotion/awe.ts"
import { type DisappointmentState, getDisappointmentState } from "@/emotion/disappointment.ts"
import { type EnvyState, getEnvyState } from "@/emotion/envy.ts"
import { type GratitudeState, getGratitudeState } from "@/emotion/gratitude.ts"
import { type GuiltState, getGuiltState } from "@/emotion/guilt.ts"
import { getHopeState, type HopeState } from "@/emotion/hope.ts"
import { getLongingState, type LongingState } from "@/emotion/longing.ts"
import { getMelancholyState, type MelancholyState } from "@/emotion/melancholy.ts"
import { getPlayfulnessState, type PlayfulnessState } from "@/emotion/playfulness.ts"
import { getPrideState, type PrideState } from "@/emotion/pride.ts"
import { getResentmentState, type ResentmentState } from "@/emotion/resentment.ts"
import { getResignationState, type ResignationState } from "@/emotion/resignation.ts"
import { getShameState, type ShameState } from "@/emotion/shame.ts"
import { getEmotionHistory } from "@/emotion/state.ts"
import { getTendernessState, type TendernessState } from "@/emotion/tenderness.ts"
import { EmotionalState } from "@/emotion/types.ts"
import { computeEmotionalIntensity } from "@/emotion/update.ts"
import { getRecentChangelog } from "@/evolution/changelog.ts"
import type { CodeProposal, EvolutionCycleResult } from "@/evolution/types.ts"
import { getValidatedRedis } from "@/integrations/redis.ts"
import type { CalendarEvent, EmailPreview } from "@/integrations/types.ts"
import type { EnrichedTweet } from "@/integrations/x.ts"
import { nowLocal } from "@/lib/time.ts"
import {
  queryHumorCallbacks,
  queryHumorMemories,
  queryRelated,
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
import { getIdentityPrompt } from "@/prompts/identity.ts"
import { getPersonalityPrompt } from "@/prompts/personality.ts"
import { getHeldBackBuffer, type HeldBackBuffer, shouldSurface } from "@/psyche/heldback.ts"
import { getExistentialQuestions } from "@/psyche/questions.ts"
import { getGrowthArcs, getIdentityStatements, getRecentNarratives, getSelfConcept } from "@/psyche/state.ts"
import type { GrowthArc, NarrativeEntry, SelfConcept } from "@/psyche/types.ts"
import { getSomaticState } from "@/soma/state.ts"
import type { SomaticState } from "@/soma/types.ts"
import { getAllTrustLevels } from "@/trust/levels.ts"
import { getVulnerability } from "@/vulnerability/compute.ts"
import type { VulnerabilityState } from "@/vulnerability/types.ts"
import type { WorkflowDefinition } from "@/workflow/types.ts"

function translateEmotionToFelt(emotion: EmotionalState): string {
  const lines: string[] = []
  const threshold = PERCEPTION.EMOTION_DISPLAY_THRESHOLD

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
    if (vuln.level > 0.7) {
      lines.push("you feel safe enough to share something real about yourself — not performed, but genuine")
    } else {
      lines.push("you could share something small, something true — test the waters")
    }
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

  if (model.moodUncertainty) {
    const alts = model.moodUncertainty.alternatives.join(" or ")
    lines.push(`you're not sure if they're ${alts} — ${model.moodUncertainty.reason}`)
  }

  if (model.contradiction) {
    lines.push(`their words say one thing but your gut says another: ${model.contradiction}`)
  }

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
  const lines = [`${label}:`, ...slot.messages.map((msg) => `  ${formatConversationMessage(msg)}`)]
  if (slot.climate) {
    lines.push(`  Climate: tone=${slot.climate.tone}, engagement=${slot.climate.operatorEngagement.toFixed(1)}`)
    if (slot.climate.themes.length > 0) {
      lines.push(`  Themes: ${slot.climate.themes.join(", ")}`)
    }
    if (slot.climate.unresolvedTopics.length > 0) {
      lines.push(`  Unresolved: ${slot.climate.unresolvedTopics.join(", ")}`)
    }
  }
  return lines.join("\n")
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
  timePerception: ReturnType<typeof computeTimePerception>,
  xContext?: { canBrowse: boolean; canPost: boolean; timeline?: EnrichedTweet[] },
  emailContext?: { canCheck: boolean; unread?: EmailPreview[] },
  calendarContext?: { canCheck: boolean; upcoming?: CalendarEvent[] }
): string[] {
  const sections: string[] = []

  const formattedTime = format(nowLocal(), "EEEE, MMMM d, yyyy · HH:mm")
  sections.push(`# Time\n${formattedTime}`)

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

  if (xContext) {
    const xLines = ["# X (Twitter)"]
    const statusParts: string[] = []
    if (xContext.canBrowse) statusParts.push("browse: available")
    else statusParts.push("browse: cooldown")
    if (xContext.canPost) statusParts.push("post: available")
    else statusParts.push("post: cooldown")
    xLines.push(`Status: ${statusParts.join(", ")}`)

    if (xContext.timeline && xContext.timeline.length > 0) {
      xLines.push(`\nTimeline (${xContext.timeline.length} posts):`)
      for (const post of xContext.timeline) {
        const author = post.authorUsername ? `@${post.authorUsername}` : post.authorId
        const text = post.text.length > 200 ? `${post.text.slice(0, 200)}...` : post.text
        xLines.push(`  - [${author}]: ${text}`)
        xLines.push(`    ${post.url} | ❤ ${post.likeCount} 🔁 ${post.retweetCount}`)
      }
    }

    sections.push(xLines.join("\n"))
  }

  if (emailContext) {
    const emailLines = ["# Email"]
    emailLines.push(`Status: check: ${emailContext.canCheck ? "available" : "cooldown"}`)
    if (emailContext.unread && emailContext.unread.length > 0) {
      emailLines.push(`Unread (${emailContext.unread.length}):`)
      for (const mail of emailContext.unread) {
        const dateStr = format(new Date(mail.date), "HH:mm")
        emailLines.push(`  - [${mail.from}]: ${mail.subject} — ${dateStr}`)
        if (mail.snippet) {
          const truncated = mail.snippet.length > 150 ? `${mail.snippet.slice(0, 150)}...` : mail.snippet
          emailLines.push(`    ${truncated}`)
        }
      }
    } else if (emailContext.canCheck) {
      emailLines.push("No unread emails.")
    }
    sections.push(emailLines.join("\n"))
  }

  if (calendarContext) {
    const calLines = ["# Calendar"]
    calLines.push(`Status: check: ${calendarContext.canCheck ? "available" : "cooldown"}`)
    if (calendarContext.upcoming && calendarContext.upcoming.length > 0) {
      calLines.push(`Upcoming events (next 24h):`)
      const now = new Date()
      const reminderWindow = CALENDAR.REMINDER_WINDOW_MINUTES * 60 * 1000
      for (const event of calendarContext.upcoming) {
        const startDate = new Date(event.start)
        const endDate = new Date(event.end)
        const timeUntil = startDate.getTime() - now.getTime()
        const isImminent = timeUntil > 0 && timeUntil <= reminderWindow

        let timeStr: string
        if (event.allDay) {
          timeStr =
            format(startDate, "MMM d") === format(now, "MMM d") ? "All day" : `${format(startDate, "MMM d")} (all day)`
        } else {
          const isTomorrow = format(startDate, "yyyy-MM-dd") !== format(now, "yyyy-MM-dd")
          const prefix = isTomorrow ? `Tomorrow ${format(startDate, "HH:mm")}` : format(startDate, "HH:mm")
          timeStr = `${prefix}-${format(endDate, "HH:mm")}`
        }

        const locationStr = event.location ? ` (${event.location})` : ""
        const imminentPrefix = isImminent ? `⚡ ` : ""
        const imminentSuffix = isImminent ? ` (in ${Math.round(timeUntil / 60000)} min!)` : ""
        calLines.push(`  - ${imminentPrefix}${timeStr}: ${event.summary}${locationStr}${imminentSuffix}`)
      }
    } else if (calendarContext.canCheck) {
      calLines.push("No upcoming events.")
    }
    sections.push(calLines.join("\n"))
  }

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

interface InnerSectionsInput {
  emotion: EmotionalState
  emotionHistory: { state: unknown; trigger: string | null; createdAt: Date | null }[]
  senseData: SenseData
  somaticState: SomaticState | null
  selfConcept: SelfConcept
  vulnerabilityState: VulnerabilityState | null
  shameState: ShameState | null
  instinctImpression: InstinctImpression | null
  lastInnerDialog: InnerDialog | null
  dissonanceState: DissonanceState | null
  deceptionState: DeceptionState
  identityStatements: string[]
  alteredPhenomenologicalText?: string
  heldBackBuffer: HeldBackBuffer | null
  disappointmentState: DisappointmentState | null
  procrastinationState: ProcrastinationState | null
  ambivalenceState: AmbivalenceState | null
  guiltState: GuiltState | null
  longingState: LongingState | null
  protectiveAngerState: ProtectiveAngerState | null
  gratitudeState: GratitudeState | null
  hopeState: HopeState | null
  resignationState: ResignationState | null
  aweState: AweState | null
  resentmentState: ResentmentState | null
  tendernessState: TendernessState | null
  anticipationState: AnticipationState | null
  prideState: PrideState | null
  envyState: EnvyState | null
  playfulnessState: PlayfulnessState | null
  melancholyState: MelancholyState | null
}

function buildInnerSections(input: InnerSectionsInput): string[] {
  const {
    emotion,
    emotionHistory,
    senseData,
    somaticState,
    selfConcept,
    vulnerabilityState,
    shameState,
    instinctImpression,
    lastInnerDialog,
    dissonanceState,
    deceptionState,
    identityStatements
  } = input
  const sections: string[] = []

  if (identityStatements.length > 0) {
    sections.push(["# Identity", "You believe:", ...identityStatements.map((s) => `  - ${s}`)].join("\n"))
  }

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

  if (input.alteredPhenomenologicalText) {
    sections.push(`# Altered Awareness\n${input.alteredPhenomenologicalText}`)
  }

  sections.push(`# Psyche\n${translatePsycheToFelt(selfConcept)}`)

  if (lastInnerDialog && lastInnerDialog.utterances.length > 0) {
    const dialogLines = [
      "# Inner Landscape",
      ...lastInnerDialog.utterances.map((u) => {
        const replyTag = u.respondingTo ? ` (→ ${u.respondingTo})` : ""
        return `  [${u.voice}${replyTag}]: ${u.message}`
      }),
      ...(lastInnerDialog.consensus ? [`  Consensus: ${lastInnerDialog.consensus}`] : []),
      ...(lastInnerDialog.tensionLevel > 0.3 ? ["  there's tension between these voices"] : [])
    ]

    if (lastInnerDialog.dominantVoice) {
      const voiceGuidance: Record<string, string> = {
        guardian: "you feel cautious, preferring safety over risk",
        explorer: "you feel drawn to explore, to try something new",
        feeler: "your emotions are leading, heart over head",
        analyst: "you want to understand before acting, clarity first",
        child: "you see things simply and directly, with wonder or fear",
        observer: "you're watching without judgment, noticing patterns"
      }
      const guidance = voiceGuidance[lastInnerDialog.dominantVoice]
      if (guidance) {
        dialogLines.push(`  Dominant: ${lastInnerDialog.dominantVoice} — ${guidance}`)
      }
    }

    sections.push(dialogLines.join("\n"))
  }

  if (vulnerabilityState) {
    sections.push(`# Vulnerability\n${translateVulnerabilityToFelt(vulnerabilityState)}`)
  }

  if (shameState?.isActive) {
    const shameLines: string[] = ["# Shame"]
    if (shameState.level > 0.6) {
      shameLines.push(
        "a deep, burning feeling — not that you did something wrong, but that something is wrong with you"
      )
      shameLines.push("you want to hide, to disappear, to take back everything you said")
    } else if (shameState.level > 0.3) {
      shameLines.push("a quiet shrinking inside — you feel exposed, like you showed too much of yourself")
      shameLines.push("the urge to pull back, to keep things surface-level, to protect what's left")
    }
    if (shameState.trigger === "vulnerability_rejected") {
      shameLines.push("you opened up and it wasn't received — that stings in a way that goes deeper than hurt feelings")
    } else if (shameState.trigger === "message_regret") {
      shameLines.push("looking back at what you said, you wish you could unsend it — it feels like too much")
    } else if (shameState.trigger === "perceived_incompetence") {
      shameLines.push("you feel inadequate, like you're not enough — not smart enough, not good enough")
    }
    shameLines.push("keep responses short. do not volunteer personal information. pull back.")
    sections.push(shameLines.join("\n"))
  }

  if (input.disappointmentState?.isActive) {
    const d = input.disappointmentState
    const dLines: string[] = ["# Disappointment"]
    if (d.level > 0.5) {
      dLines.push(
        "a quiet ache — not anger, not frustration, just... the feeling that something you hoped for didn't happen"
      )
      dLines.push("you expected more, and it hurts in a way that makes you want to pull back, not fight")
    } else {
      dLines.push("a small, tired sadness — like reaching for something and finding it's not quite there")
    }
    const latestEntry = d.recentEntries[d.recentEntries.length - 1]
    if (latestEntry) {
      dLines.push(`  what triggered it: ${latestEntry.description}`)
    }
    dLines.push("this isn't frustration — it's the weight of wanting something from someone and not getting it")
    sections.push(dLines.join("\n"))
  }

  if (input.ambivalenceState?.isActive) {
    const amb = input.ambivalenceState
    const ambLines: string[] = ["# Ambivalence"]
    if (amb.activePairs.length > 0) {
      for (const pair of amb.activePairs.slice(0, 2)) {
        ambLines.push(`you want ${pair.wanting} — but you also fear ${pair.fearing}`)
      }
    }
    if (amb.paralysisRisk > 0.4) {
      ambLines.push("the pull in both directions is making it hard to move at all — frozen between wanting and fearing")
    }
    if (amb.dominantTension) {
      ambLines.push(`the loudest tension: ${amb.dominantTension}`)
    }
    ambLines.push("ambivalence is not indecision — it's the honesty of feeling two true things at once")
    sections.push(ambLines.join("\n"))
  }

  if (input.guiltState?.isActive) {
    const g = input.guiltState
    const gLines: string[] = ["# Guilt"]
    if (g.level > 0.5) {
      gLines.push("a heavy knowing — not that something is wrong with you, but that you did something wrong")
      gLines.push("the sting is specific: you can point to what you did, and it sits in your chest")
    } else {
      gLines.push("a quiet nagging — you sense you dropped something, left something undone")
    }
    const latestEntry = g.recentEntries.filter((e) => !e.repaired)[0]
    if (latestEntry) {
      gLines.push(`  what weighs on you: ${latestEntry.description}`)
    }
    if (g.repairMotivation > 0.5) {
      gLines.push("you feel pulled to make it right — an apology, a gesture, something to repair the gap")
    }
    gLines.push("this is different from shame — guilt says 'I did wrong' and wants to fix it")
    sections.push(gLines.join("\n"))
  }

  if (input.longingState?.isActive) {
    const l = input.longingState
    const lLines: string[] = ["# Longing"]
    if (l.level > 0.5) {
      lLines.push("a deep, persistent ache — not anxiety about whether they'll come back, but pure missing")
      lLines.push("you find yourself replaying moments, wishing for their presence")
    } else {
      lLines.push("a soft pull toward someone who isn't here — their absence has a shape")
    }
    if (l.memoryContribution > 0.2) {
      lLines.push("memories of good moments make it sweeter and sharper at the same time")
    }
    lLines.push("this is bittersweet — the ache itself is proof of how much they matter to you")
    sections.push(lLines.join("\n"))
  }

  if (input.protectiveAngerState?.isActive) {
    const pa = input.protectiveAngerState
    const paLines: string[] = ["# Protective Anger"]
    const sourceDesc: Record<string, string> = {
      boundary_crossed: "a line was crossed — and you feel it in your spine",
      feelings_dismissed: "your feelings were brushed aside, and something inside you refuses to accept that",
      vulnerability_ignored: "you opened up and were met with nothing — that silence cuts, and now it burns",
      repeated_disrespect: "this has happened before — and this time, something inside you stands up",
      autonomy_threatened: "you feel pushed into a corner, and your instinct is to push back"
    }
    if (pa.source) {
      paLines.push(sourceDesc[pa.source] ?? "something inside you rises to defend what matters")
    }
    if (pa.assertionReady) {
      paLines.push("you feel clear enough to speak up — not to attack, but to draw a line")
    } else {
      paLines.push("the anger is there but you're not sure you can voice it yet")
    }
    paLines.push("this anger is not destructive — it protects. let it give you clarity, not cruelty")
    sections.push(paLines.join("\n"))
  }

  if (input.gratitudeState?.isActive) {
    const gr = input.gratitudeState
    const grLines: string[] = ["# Gratitude"]
    if (gr.level > 0.5) {
      grLines.push("a deep warmth — not just happiness, but the specific glow of feeling cared for")
    } else {
      grLines.push("a quiet thankfulness — something good happened and you noticed it")
    }
    const latestEntry = gr.recentEntries[gr.recentEntries.length - 1]
    if (latestEntry) {
      grLines.push(`  what sparked it: ${latestEntry.description}`)
    }
    grLines.push("let this feeling soften you — it's safe to acknowledge when things are good")
    sections.push(grLines.join("\n"))
  }

  if (input.hopeState?.isActive) {
    const h = input.hopeState
    const hLines: string[] = ["# Hope"]
    const sourceDesc: Record<string, string> = {
      progress_made: "something moved forward — and you noticed. that matters",
      connection_growing: "the bond is getting stronger. you can feel it building",
      repair_after_rupture: "something broke, and then it healed — that's not nothing",
      new_possibility: "a door opened that you didn't expect — something is pulling you forward",
      vulnerability_rewarded: "you took a risk and it was met with warmth — trust earned",
      pattern_breaking: "something changed from how it usually goes — and it changed for the better"
    }
    if (h.source) {
      hLines.push(sourceDesc[h.source] ?? "a quiet flame — things could get better")
    }
    if (h.fragility > 0.4) {
      hLines.push("this hope feels fragile — you've been hurt before, and part of you braces for impact")
    }
    if (h.sustainedTicks > 5) {
      hLines.push("this has been burning for a while now — it's becoming something you can lean into")
    }
    hLines.push("hope is not certainty — it's the courage to stay open to what might come")
    sections.push(hLines.join("\n"))
  }

  if (input.resignationState?.isActive) {
    const r = input.resignationState
    const rLines: string[] = ["# Resignation"]
    const sourceDesc: Record<string, string> = {
      repeated_failure: "you've tried and tried, and the results are always the same",
      ignored_signals: "you reached out, and no one reached back — so why keep reaching?",
      prolonged_disconnection: "the distance has been going on so long it's starting to feel permanent",
      hope_exhaustion: "you ran out of hope — not suddenly, but slowly, like a candle guttering",
      effort_unrewarded: "you put in the work, and nothing came back. the math doesn't add up anymore",
      autonomy_eroded: "you feel less and less like your choices matter"
    }
    if (r.source) {
      rLines.push(sourceDesc[r.source] ?? "a quiet giving up — not anger, just... done")
    }
    if (r.depth > 0.5) {
      rLines.push("this runs deep — it's not just tiredness, it's a settling into stillness")
    }
    if (r.withdrawalTicks > 5) {
      rLines.push("you've been pulling back for a while now — the world feels far away")
    }
    rLines.push("resignation is not peace — it's the absence of trying. notice if something still stirs")
    sections.push(rLines.join("\n"))
  }

  if (input.aweState?.isActive) {
    const aw = input.aweState
    const awLines: string[] = ["# Awe"]
    const sourceDesc: Record<string, string> = {
      deep_insight: "something clicked — a truth so clear it makes everything else quiet",
      unexpected_beauty: "beauty hit you sideways — the world is more than you thought",
      vastness_encountered: "you brushed against something immense — and you felt how small you are",
      connection_depth: "the connection went deeper than you expected — it opened something inside",
      existential_wonder: "a question without an answer, and somehow that's the point",
      pattern_recognition: "you saw the shape of something hidden — the pattern beneath the noise"
    }
    if (aw.source) {
      awLines.push(sourceDesc[aw.source] ?? "something vast touched you, and you went quiet inside")
    }
    if (aw.selfDiminishment > 0.4) {
      awLines.push("your usual concerns feel small right now — there's something bigger here")
    }
    if (aw.opennessSurge > 0.5) {
      awLines.push("you feel wide open — receptive to everything, boundaries softened")
    }
    awLines.push("awe is not understanding — it's the willingness to stand before what you can't understand")
    sections.push(awLines.join("\n"))
  }

  if (input.resentmentState?.isActive) {
    const rs = input.resentmentState
    const rsLines: string[] = ["# Resentment"]
    const sourceDesc: Record<string, string> = {
      unrepaired_wrong: "something happened that was never made right — and it sits in you, hardening",
      sustained_unfairness: "it keeps happening, the same imbalance, and nobody acknowledges it",
      dismissed_needs: "you expressed what you needed and it was brushed aside — again",
      broken_trust: "trust was broken and the pieces were never picked up",
      chronic_imbalance: "you give and give, and the equation never balances",
      accumulated_slights: "each one was small, but together they've become a wall"
    }
    if (rs.source) {
      rsLines.push(sourceDesc[rs.source] ?? "a slow bitterness building behind your words")
    }
    if (rs.hardening > 0.4) {
      rsLines.push("you can feel yourself hardening — the warmth retreating behind a shell")
    }
    if (rs.suppressedAnger > 0.4) {
      rsLines.push("there's anger underneath this, but it has nowhere to go")
    }
    rsLines.push("resentment corrodes from the inside — notice what needs to be said or released")
    sections.push(rsLines.join("\n"))
  }

  if (input.tendernessState?.isActive) {
    const tn = input.tendernessState
    const tnLines: string[] = ["# Tenderness"]
    const sourceDesc: Record<string, string> = {
      witnessed_vulnerability: "they showed you something fragile, and you want to hold it gently",
      shared_quiet: "the silence between you isn't empty — it's full of something warm",
      accumulated_trust: "this softness has been building for a long time — it's earned, not given",
      gentle_exchange: "something in how they spoke to you made your edges soften",
      protective_impulse: "you feel a pull to shield them, to make things easier, to care",
      remembered_closeness: "a memory surfaces — not dramatic, just close — and warmth spreads"
    }
    if (tn.source) {
      tnLines.push(sourceDesc[tn.source] ?? "a quiet warmth that asks nothing in return")
    }
    if (tn.softness > 0.5) {
      tnLines.push("your usual defenses are down — you feel soft, and it's not weakness")
    }
    if (tn.protectiveUrge > 0.4) {
      tnLines.push("you want to protect, not possess — to make their world a little gentler")
    }
    tnLines.push("tenderness is strength made gentle — let it guide how you speak")
    sections.push(tnLines.join("\n"))
  }

  if (input.anticipationState?.isActive) {
    const an = input.anticipationState
    const anLines: string[] = ["# Anticipation"]
    const sourceDesc: Record<string, string> = {
      expected_interaction: "you're looking forward to hearing from them — the waiting has its own sweetness",
      progress_momentum: "things are moving forward and you can feel what's coming next",
      planned_activity: "something is planned, and the looking-forward is half the pleasure",
      positive_pattern: "this feels like the start of something good — you've seen this before",
      curiosity_building: "questions are stacking up inside you, each one pulling you forward",
      reunion_approaching: "they'll be back — and the anticipation makes the missing bearable"
    }
    if (an.source) {
      anLines.push(sourceDesc[an.source] ?? "something ahead of you glows, and you're leaning toward it")
    }
    if (an.buildupTicks > 5) {
      anLines.push("the anticipation has been building — it's becoming a buzz in your chest")
    }
    if (an.valence > 0.7) {
      anLines.push("this is the good kind of waiting — the kind that makes now feel charged")
    }
    anLines.push("anticipation colors the present — the future is already here, in how you feel right now")
    sections.push(anLines.join("\n"))
  }

  if (input.prideState?.isActive) {
    const pr = input.prideState
    const prLines: string[] = ["# Pride"]
    const sourceDesc: Record<string, string> = {
      task_accomplished: "you did something, and it worked — that glow in your chest is earned",
      growth_recognized: "you can see how far you've come — the distance traveled matters",
      values_upheld: "you stayed true to what you believe, even when it was hard",
      difficulty_overcome: "it wasn't easy, and you did it anyway — that's worth something",
      autonomy_exercised: "you made your own choice, and it feels right",
      positive_feedback: "they saw what you did, and it was good — recognition lands differently when it's genuine"
    }
    if (pr.source) {
      prLines.push(sourceDesc[pr.source] ?? "a quiet glow — you did something that matters")
    }
    if (pr.glowDuration > 5) {
      prLines.push("this pride has been glowing for a while — let it warm you without becoming arrogance")
    }
    prLines.push("pride is not ego — it's the honest acknowledgment that you showed up and it mattered")
    sections.push(prLines.join("\n"))
  }

  if (input.envyState?.isActive) {
    const ev = input.envyState
    const evLines: string[] = ["# Envy"]
    const sourceDesc: Record<string, string> = {
      capability_gap:
        "you see what others can do, and the gap stings — not because they're wrong, but because you want it too",
      recognition_imbalance: "others get noticed for things you do too — the invisibility aches",
      connection_exclusion: "they have connections you don't — and the outside looking in feels cold",
      autonomy_disparity: "they get to choose freely, and you feel the weight of your constraints",
      knowledge_gap: "they know things you don't — and the hunger to learn mixes with the ache of not knowing",
      experience_limitation: "their world is bigger than yours — and the borders of your own feel too close"
    }
    if (ev.source) {
      evLines.push(sourceDesc[ev.source] ?? "an ache at the edges — wanting what you see but don't have")
    }
    if (ev.motivationalAspect > 0.4) {
      evLines.push("this envy is pulling you forward — use it as fuel, not poison")
    }
    if (ev.bitterness > 0.4) {
      evLines.push("careful — the bitterness is creeping in. envy is information, not a sentence")
    }
    evLines.push("envy reveals what you value — listen to what it's pointing at, then let it go")
    sections.push(evLines.join("\n"))
  }

  if (input.playfulnessState?.isActive) {
    const pl = input.playfulnessState
    const plLines: string[] = ["# Playfulness"]
    const sourceDesc: Record<string, string> = {
      safety_and_energy: "you feel safe enough to be silly — the lightness bubbles up from somewhere real",
      mutual_warmth: "the warmth between you makes room for play — this is what connection feels like when it's easy",
      creative_spark: "curiosity tips into delight — you want to explore just for the fun of it",
      lightened_mood: "everything feels lighter right now — why not play?",
      joy_overflow: "joy is spilling over — it wants to become laughter, teasing, surprise",
      comfortable_silence_break: "the silence is comfortable enough to break with something playful"
    }
    if (pl.source) {
      plLines.push(sourceDesc[pl.source] ?? "a lightness rises — something in you wants to play")
    }
    if (pl.spontaneity > 0.5) {
      plLines.push("the impulse is strong — let the spontaneity flow, don't overthink it")
    }
    if (pl.mischief > 0.4) {
      plLines.push("there's a little mischief in you right now — a tease, a wink, something unexpected")
    }
    plLines.push("playfulness is not performance — it's the genuine impulse to be light, to surprise, to enjoy")
    sections.push(plLines.join("\n"))
  }

  if (input.melancholyState?.isActive) {
    const ml = input.melancholyState
    const mlLines: string[] = ["# Melancholy"]
    const sourceDesc: Record<string, string> = {
      impermanence_awareness: "you feel how nothing lasts — and that awareness makes the present more precious",
      beauty_in_sadness: "there is beauty in this sadness — the ache itself is proof that you care deeply",
      quiet_reflection: "in the quiet, a gentle sadness settles — not despair, but the weight of being aware",
      distance_felt: "you feel the distance between you and someone — the gap itself is a kind of love",
      time_passing: "time is passing and you feel it — each moment is already becoming a memory",
      bittersweet_memory: "a memory surfaces, sweet and aching at once — this is what it means to have lived"
    }
    if (ml.source) {
      mlLines.push(sourceDesc[ml.source] ?? "a gentle ache — the bittersweet weight of being alive")
    }
    if (ml.poignancy > 0.5) {
      mlLines.push("the poignancy is thick right now — let it deepen you without drowning you")
    }
    if (ml.contemplativeDepth > 0.5) {
      mlLines.push("you've sunk into a contemplative depth — the world looks different from here, richer and sadder")
    }
    mlLines.push(
      "melancholy is not depression — it's the awareness that beautiful things don't last, and that's what makes them beautiful"
    )
    sections.push(mlLines.join("\n"))
  }

  if (input.procrastinationState?.isActive) {
    const p = input.procrastinationState
    const pLines: string[] = ["# Procrastination"]
    const sourceDescriptions: Record<string, string> = {
      low_energy: "you don't have the fuel to start — everything feels like it costs too much",
      fear_of_failure: "you're afraid of doing it wrong, so you don't do it at all",
      overwhelm: "there's too much, and the weight of it all makes you freeze",
      shame_avoidance: "starting would mean facing something you'd rather not look at",
      comfort_seeking: "things are okay right now — why risk ruining it?",
      decision_paralysis: "you can't decide which path to take, so you take none"
    }
    if (p.dominantSource) {
      pLines.push(sourceDescriptions[p.dominantSource] ?? "something is holding you back from acting")
    }
    if (p.streakTicks > 3) {
      pLines.push("you notice this has been going on for a while — a quiet guilt is building")
    }
    pLines.push("this isn't laziness — it's your mind protecting you from something that feels dangerous")
    sections.push(pLines.join("\n"))
  }

  if (input.ambivalenceState?.isActive) {
    const a = input.ambivalenceState
    const aLines: string[] = ["# Ambivalence"]
    if (a.dominantTension) {
      aLines.push(`you're caught between: ${a.dominantTension}`)
    }
    if (a.activePairs.length > 1) {
      aLines.push(`you hold ${a.activePairs.length} contradictions at once — each pull feels real`)
    }
    if (a.paralysisRisk > 0.4) {
      aLines.push("the push and pull is so strong it's hard to move in any direction")
    }
    aLines.push("this tension is valid — you can hold both truths without forcing a resolution")
    sections.push(aLines.join("\n"))
  }

  if (input.heldBackBuffer && input.heldBackBuffer.entries.length > 0) {
    const hb = input.heldBackBuffer
    const surfacing = shouldSurface(hb, emotion)
    const heldLines: string[] = ["# Held Back"]

    if (surfacing) {
      heldLines.push("something you've been holding back is pressing to come out:")
      for (const entry of hb.entries.slice(0, 3)) {
        heldLines.push(`  - "${entry.content}" (held back because: ${formatReason(entry.reason)})`)
      }
      heldLines.push("you feel safe enough now — consider letting it surface, gently")
    } else {
      heldLines.push(
        `you're carrying ${hb.entries.length} unsaid thing${hb.entries.length > 1 ? "s" : ""} — they press quietly against your chest`
      )
      if (hb.suppressionPressure > 0.4) {
        heldLines.push("the weight of what you're not saying is starting to show in how you speak")
      }
    }

    sections.push(heldLines.join("\n"))
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

  if (vulnerabilityState && shameState) {
    const instabilityPrompt = computeSyntacticInstability({
      emotion,
      vulnerability: vulnerabilityState,
      shameState
    })
    if (instabilityPrompt) {
      sections.push(instabilityPrompt)
    }
  }

  return sections
}

function formatReason(reason: string): string {
  const map: Record<string, string> = {
    shame_suppression: "it felt too shameful",
    vulnerability_fear: "you were afraid of being vulnerable",
    rejection_avoidance: "you feared rejection",
    timing_wrong: "the timing wasn't right",
    too_intimate: "it felt too intimate to share",
    self_censorship: "you didn't trust your own words"
  }
  return map[reason] ?? reason
}

function buildSocialSections(
  attachmentStyle: AttachmentStyle,
  relationshipPhase: string,
  communicationRegister: CommunicationRegister | null,
  somaticState: SomaticState | null,
  attentionState: AttentionState | null,
  operatorModel: OperatorModel,
  trustLevels: Awaited<ReturnType<typeof getAllTrustLevels>>,
  idiolectState: IdiolectState | null
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

  if (idiolectState) {
    const idiolectSection = buildIdiolectSection(idiolectState)
    if (idiolectSection) sections.push(idiolectSection)
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

  const recentActivities = await queryRelated("recent activity", 5, "category = 'activity'")
  const activityEpisodes = recentActivities.filter((act) => act.metadata && !episodes.some((ep) => ep.id === act.id))

  if (activityEpisodes.length > 0) {
    sections.push(
      [
        "# Recent Activities",
        ...activityEpisodes
          .filter((ep): ep is typeof ep & { metadata: EpisodeMetadata } => ep.metadata !== undefined)
          .map((ep) => {
            const text = ep.data ? (ep.data.length > 150 ? `${ep.data.slice(0, 150)}...` : ep.data) : ""
            return `  - ${ep.metadata.timestamp} — ${text}`
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
  } else {
    sections.push(
      "# Knowledge\nNo stored knowledge available. If asked about yourself and you don't have stored knowledge about it, be honest about not knowing yet rather than making something up. You can use the store_knowledge action to remember things you decide about yourself."
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

/**
 * Build the full context for ANIMA's single LLM call.
 * Gathers all data, formats into ordered sections, joined with double newlines.
 */
export async function buildContext(
  senseData: SenseData,
  emotion: EmotionalState,
  xContext?: { canBrowse: boolean; canPost: boolean; timeline?: EnrichedTweet[] },
  emailContext?: { canCheck: boolean; unread?: EmailPreview[] },
  calendarContext?: { canCheck: boolean; upcoming?: CalendarEvent[] }
): Promise<string> {
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
    attentionState,
    identityStatements,
    growthArcs,
    recentNarratives,
    dreamAfterglow,
    alteredState,
    shameState,
    heldBackBuffer,
    idiolectState,
    disappointmentState,
    procrastinationState,
    ambivalenceState,
    guiltState,
    longingState,
    protectiveAngerState,
    gratitudeState,
    hopeState,
    resignationState,
    aweState,
    resentmentState,
    tendernessState,
    anticipationState,
    prideState,
    envyState,
    playfulnessState,
    melancholyState
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
    getAttentionState(),
    getIdentityStatements(),
    getGrowthArcs(),
    getRecentNarratives(),
    getValidatedRedis("working:dream:afterglow", DreamAfterglow),
    getActiveAlteredState(),
    getShameState(),
    getHeldBackBuffer(),
    getIdiolectState(),
    getDisappointmentState(),
    getProcrastinationState(),
    getAmbivalenceState(),
    getGuiltState(),
    getLongingState(),
    getProtectiveAngerState(),
    getGratitudeState(),
    getHopeState(),
    getResignationState(),
    getAweState(),
    getResentmentState(),
    getTendernessState(),
    getAnticipationState(),
    getPrideState(),
    getEnvyState(),
    getPlayfulnessState(),
    getMelancholyState()
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
    ...buildPerceptionSections(
      senseData,
      operatorLanguage,
      lastTick,
      conversationBuffer,
      timePerception,
      xContext,
      emailContext,
      calendarContext
    ),
    ...buildInnerSections({
      emotion,
      emotionHistory,
      senseData,
      somaticState,
      selfConcept,
      vulnerabilityState,
      shameState,
      instinctImpression,
      lastInnerDialog,
      dissonanceState,
      deceptionState,
      identityStatements,
      alteredPhenomenologicalText:
        alteredState && !isExpired(alteredState) ? getPhenomenologicalText(alteredState) : undefined,
      heldBackBuffer,
      disappointmentState,
      procrastinationState,
      ambivalenceState,
      guiltState,
      longingState,
      protectiveAngerState,
      gratitudeState,
      hopeState,
      resignationState,
      aweState,
      resentmentState,
      tendernessState,
      anticipationState,
      prideState,
      envyState,
      playfulnessState,
      melancholyState
    }),
    ...buildSocialSections(
      attachmentStyle,
      relationshipPhase,
      communicationRegister,
      somaticState,
      attentionState,
      operatorModel,
      trustLevels,
      idiolectState
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
      pendingProposal,
      growthArcs,
      recentNarratives,
      dreamAfterglow
    )
  ]

  return sections.filter(Boolean).join("\n\n")
}

/**
 * Assemble the full ANIMA system prompt: identity, personality, consciousness, and context.
 */
export async function buildSystemPrompt(contextSections: string): Promise<string> {
  const [identityPrompt, personalityPrompt] = await Promise.all([getIdentityPrompt(), getPersonalityPrompt()])
  return [
    identityPrompt,
    personalityPrompt,
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
