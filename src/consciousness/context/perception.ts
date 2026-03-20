import { format } from "date-fns"
import type { SenseData, TickSummary } from "@/consciousness/types.ts"
import type { ConversationSlot } from "@/expression/communication/types.ts"
import { sanitizeForContext } from "@/governance/security/defense.ts"
import type { WorkflowDefinition } from "@/governance/workflow/types.ts"
import { CALENDAR } from "@/infra/integrations/constants.ts"
import type { CalendarEvent, EmailPreview } from "@/infra/integrations/types.ts"
import type { EnrichedTweet } from "@/infra/integrations/x.ts"
import { nowLocal } from "@/infra/lib/time.ts"
import type { computeTimePerception } from "@/perception/pace.ts"

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
  const lines = [`${label}:`, ...slot.messages.map((message) => `  ${formatConversationMessage(message)}`)]
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
            ...preview.map((message) => `  ${formatConversationMessage(message, 200)}`)
          ].join("\n")
        )
      }
    }
  })
  return parts.join("\n\n")
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

function countTrailingUnansweredMessages(buffer: ConversationSlot[]): number {
  const activeSlot = buffer.at(-1)
  if (!activeSlot || activeSlot.messages.length === 0) return 0

  let count = 0
  for (const msg of [...activeSlot.messages].reverse()) {
    if (msg.role === "anima") count++
    else break
  }
  return count
}

export function buildPerceptionSections(
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

    const interruptNote = senseData.interruptedPreviousSend
      ? "\nNote: The operator sent additional messages while you were still responding. They may be continuing their thought, reacting to what you said, or changing topic. Respond naturally to the full conversation — don't repeat what you already said."
      : ""

    sections.push(
      `# Messages\nNew messages from operator (${senseData.pendingMessages.length}):\n${messageLines.join("\n")}${interruptNote}`
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
      xContext.timeline.forEach((post) => {
        const author = post.authorUsername ? `@${post.authorUsername}` : post.authorId
        const rawText = post.text.length > 200 ? `${post.text.slice(0, 200)}...` : post.text
        const text = sanitizeForContext(rawText)
        xLines.push(`  - [${author}]: ${text}`)
        xLines.push(`    ${post.url} | ❤ ${post.likeCount} 🔁 ${post.retweetCount}`)
      })
    }

    sections.push(xLines.join("\n"))
  }

  if (emailContext) {
    const emailLines = ["# Email"]
    emailLines.push(`Status: check: ${emailContext.canCheck ? "available" : "cooldown"}`)
    if (emailContext.unread && emailContext.unread.length > 0) {
      emailLines.push(`Unread (${emailContext.unread.length}):`)
      emailContext.unread.forEach((mail) => {
        const dateStr = format(new Date(mail.date), "HH:mm")
        emailLines.push(`  - [${sanitizeForContext(mail.from)}]: ${sanitizeForContext(mail.subject)} — ${dateStr}`)
        if (mail.snippet) {
          const rawSnippet = mail.snippet.length > 150 ? `${mail.snippet.slice(0, 150)}...` : mail.snippet
          emailLines.push(`    ${sanitizeForContext(rawSnippet)}`)
        }
      })
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
      calendarContext.upcoming.forEach((event) => {
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
      })
    } else if (calendarContext.canCheck) {
      calLines.push("No upcoming events.")
    }
    sections.push(calLines.join("\n"))
  }

  if (senseData.conversationState) {
    const conversationState = senseData.conversationState
    const lines = [
      "# Conversation State",
      "Active conversation: yes",
      `Waiting for reply: ${conversationState.waitingSeconds}s`,
      conversationState.replyReceived ? "Operator just replied." : "No reply received this cycle."
    ]
    const unanswered = countTrailingUnansweredMessages(conversationBuffer)
    if (unanswered > 0) {
      lines.push(`Your last ${unanswered} message${unanswered > 1 ? "s have" : " has"} gone unanswered.`)
    }
    sections.push(lines.join("\n"))
  } else {
    const unanswered = countTrailingUnansweredMessages(conversationBuffer)
    const lines = ["# Conversation State", "Active conversation: no"]
    if (unanswered > 0) {
      lines.push(`Your last ${unanswered} message${unanswered > 1 ? "s have" : " has"} gone unanswered.`)
    }
    sections.push(lines.join("\n"))
  }

  return sections
}
