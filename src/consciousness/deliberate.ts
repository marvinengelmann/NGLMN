import { computeVoiceModifiers } from "@/affect/altered/compute.ts"
import { generateContextualImpulse } from "@/cognition/boredom.ts"
import { ATTENTION } from "@/cognition/constants.ts"
import { findAutomaticHabit } from "@/cognition/habit.ts"
import { getHabitState } from "@/cognition/habits.ts"
import { computeTemperatureFromMetacognition } from "@/cognition/metacognition/temperature.ts"
import { detectCognitiveConflict, shouldInstinctOverride } from "@/cognition/override.ts"
import { generateInnerDialog } from "@/cognition/polyphony/dialog.ts"
import { getVoiceDominanceBoost, selectActiveVoices, shouldRunDialog } from "@/cognition/polyphony/voices.ts"
import { callIntelligence } from "@/core/intelligence.ts"
import { thinkDream } from "@/expression/dream/thinking.ts"
import { thinkMorning, thinkReflect } from "@/expression/routine/thinking.ts"
import { fetchUpcomingEvents, isCaldavEnabled } from "@/infra/integrations/caldav.ts"
import { CALENDAR, SOCIAL_MEDIA } from "@/infra/integrations/constants.ts"
import { canCheckCalendar, canCheckEmail, canPerformSocialMedia } from "@/infra/integrations/cooldowns.ts"
import { fetchUnreadEmails, isImapEnabled } from "@/infra/integrations/imap.ts"
import type { CalendarEvent, EmailPreview } from "@/infra/integrations/types.ts"
import { type EnrichedTweet, getHomeTimeline, isXEnabled } from "@/infra/integrations/x.ts"
import { log } from "@/infra/lib/logger.ts"
import { captureError } from "@/infra/lib/sentry.ts"
import { queryRelated } from "@/memory/episodic.ts"
import { getGoalsByPriority } from "@/memory/goals.ts"
import { getOperatorProfile } from "@/relational/mind/profile.ts"
import { getGenesisPersonalityType } from "@/self/genesis/state.ts"
import { getStructuredExistentialQuestions } from "@/self/psyche/questions.ts"
import { buildContext, buildSystemPrompt } from "./context/builder.ts"
import type { TickState } from "./pipeline/types.ts"
import { AnimaDecision, type DeliberateResult } from "./types.ts"

/**
 * DELIBERATE phase — main LLM decision with polyphony and instinct integration.
 */
export async function deliberate(tickState: TickState): Promise<DeliberateResult> {
  const { sense: senseResult, feel: feelResult, preloaded } = tickState

  const senseData = {
    pendingMessages: senseResult.pendingMessages,
    perception: senseResult.perception,
    health: senseResult.health,
    weather: senseResult.perception.weatherData ?? null,
    conversationState: senseResult.conversationState,
    triggeredWorkflows: senseResult.triggeredWorkflows,
    moodContext: senseResult.moodContext,
    interruptedPreviousSend: senseResult.interruptedPreviousSend
  }

  let xContext: { canBrowse: boolean; canPost: boolean; timeline?: EnrichedTweet[] } | undefined
  if (isXEnabled()) {
    const socialStatus = await canPerformSocialMedia()
    let timeline: EnrichedTweet[] | undefined
    if (socialStatus.canBrowse) {
      try {
        timeline = await getHomeTimeline(SOCIAL_MEDIA.TIMELINE_MAX_RESULTS)
      } catch (e) {
        log.warn("Failed to pre-fetch X timeline", { error: e instanceof Error ? e.message : String(e) })
      }
    }
    xContext = { ...socialStatus, timeline }
  }

  let emailContext: { canCheck: boolean; unread?: EmailPreview[] } | undefined
  if (isImapEnabled()) {
    const canCheck = await canCheckEmail()
    if (canCheck) {
      try {
        const unread = await fetchUnreadEmails()
        emailContext = { canCheck: true, unread }
      } catch (e) {
        captureError(e, { phase: "email_fetch" })
        emailContext = { canCheck: true }
      }
    } else {
      emailContext = { canCheck: false }
    }
  }

  let calendarContext: { canCheck: boolean; upcoming?: CalendarEvent[] } | undefined
  if (isCaldavEnabled()) {
    const canCheck = await canCheckCalendar()
    if (canCheck) {
      try {
        const upcoming = await fetchUpcomingEvents(CALENDAR.UPCOMING_WINDOW_HOURS)
        calendarContext = { canCheck: true, upcoming }
      } catch (e) {
        captureError(e, { phase: "calendar_fetch" })
        calendarContext = { canCheck: true }
      }
    } else {
      calendarContext = { canCheck: false }
    }
  }

  const contextString = await buildContext(tickState, senseData, xContext, emailContext, calendarContext)
  const systemPrompt = await buildSystemPrompt(contextString, {
    communicationSimplification: feelResult.communicationSimplification,
    hedgingLevel: feelResult.hedgingLevel
  })

  const alteredState = preloaded.alteredState
  const alteredVoiceModifiers = alteredState ? computeVoiceModifiers(alteredState) : undefined
  const dominanceBoost = await getVoiceDominanceBoost()

  const mergedModifiers: Partial<Record<string, number>> = { ...dominanceBoost, ...alteredVoiceModifiers }
  const hasModifiers = Object.keys(mergedModifiers).length > 0

  const activeVoices = selectActiveVoices(
    feelResult.emotion,
    await getGenesisPersonalityType(),
    {
      dissonanceScore: feelResult.dissonance.activeDissonance,
      action: "pending",
      hasMessages: senseResult.pendingMessages.length > 0
    },
    hasModifiers ? mergedModifiers : undefined
  )

  let innerDialog: DeliberateResult["innerDialog"]
  if (
    shouldRunDialog(
      feelResult.emotion,
      senseResult.pendingMessages.length > 0,
      feelResult.dissonance.activeDissonance,
      "pending"
    )
  ) {
    innerDialog =
      (await generateInnerDialog({
        activeVoices,
        emotion: feelResult.emotion,
        soma: feelResult.soma,
        situationSummary:
          senseResult.pendingMessages.length > 0
            ? `${senseResult.pendingMessages.length} new messages from operator`
            : "quiet tick, processing internal state",
        dissonanceScore: feelResult.dissonance.activeDissonance,
        instinctImpulse: feelResult.instinct.impulse
      })) ?? undefined
  }

  const habitState = await getHabitState()
  const automaticHabit = senseResult.pendingMessages.length === 0 ? findAutomaticHabit(habitState.habits, "idle") : null
  if (automaticHabit) {
    log.info("Automatic habit triggered", { pattern: automaticHabit.pattern, strength: automaticHabit.strength })

    const action = automaticHabit.pattern === "idle" ? "idle" : "reflect"
    const decision: AnimaDecision = {
      reasoning: `Automatic habit: ${automaticHabit.pattern} (strength ${automaticHabit.strength.toFixed(2)})`,
      messages: [],
      expectsReply: false,
      action,
      workflowId: null,
      corrections: []
    }

    return {
      decision,
      systemPrompt,
      instinctOverride: false,
      innerDialog
    }
  }

  if (shouldInstinctOverride(feelResult.instinct, feelResult.soma)) {
    log.info("Instinct override triggered", { impulse: feelResult.instinct.impulse })

    const action =
      feelResult.instinct.impulse === "avoid" || feelResult.instinct.impulse === "withdraw" ? "idle" : "reflect"
    const decision: AnimaDecision = {
      reasoning: `Instinct override: ${feelResult.instinct.basis}`,
      messages: [],
      expectsReply: false,
      action,
      workflowId: null,
      corrections: []
    }

    return {
      decision,
      systemPrompt,
      instinctOverride: true,
      innerDialog,
      cognitiveConflict: detectCognitiveConflict(feelResult.instinct, action)
    }
  }

  let userPrompt = "Process your current perception and decide what to do."

  if (feelResult.attentionState === "blank") {
    log.info("Attention blank — forcing idle")
    return {
      decision: {
        reasoning: "Mind is blank. No thoughts forming.",
        messages: [],
        expectsReply: false,
        action: "idle",
        workflowId: null,
        corrections: []
      },
      systemPrompt,
      instinctOverride: true,
      innerDialog
    }
  }

  if (feelResult.attentionState === "drifting" && Math.random() < ATTENTION.DRIFT_INJECTION_PROBABILITY) {
    const driftMemories = await queryRelated("random thought memory association", 1)
    if (driftMemories.length > 0 && driftMemories[0]?.data) {
      userPrompt = `${userPrompt}\n\n[A stray memory surfaces: "${driftMemories[0].data.slice(0, 200)}"]`
    }
  }

  const consecutiveIdle = preloaded.consecutiveIdleTicks
  const [operatorProfile, activeGoals, existentialQuestions, recentEpisodes] = await Promise.all([
    getOperatorProfile(),
    getGoalsByPriority().then((goals) => goals.map((g) => g.description).filter((d): d is string => d != null)),
    getStructuredExistentialQuestions(),
    queryRelated("meaningful recent interaction", 3).then((eps) => eps.map((e) => e.data).filter(Boolean) as string[])
  ])

  const contextualImpulse = await generateContextualImpulse({
    emotion: feelResult.emotion,
    consecutiveIdleTicks: consecutiveIdle,
    recentEpisodes,
    operatorProfile,
    activeGoals,
    existentialQuestions
  })
  if (contextualImpulse) {
    userPrompt = `${userPrompt}\n\n[A spontaneous thought bubbles up: "${contextualImpulse}"]`
  }

  if (innerDialog?.utterances.length) {
    const dialogSection = [
      "\n## Inner Dialog",
      `Active voices: ${innerDialog.activeVoices.join(", ")}`,
      ...innerDialog.utterances.map((u) => `[${u.voice}]: ${u.message}`),
      ...(innerDialog.consensus ? [`Consensus: ${innerDialog.consensus}`] : []),
      ...(innerDialog.dominantVoice ? [`Dominant voice: ${innerDialog.dominantVoice}`] : []),
      ...(innerDialog.tensionLevel > 0.3 ? ["There's tension between these voices."] : []),
      "",
      "Consider the inner dialog. The consensus and dominant voice should inform your reasoning."
    ].join("\n")
    userPrompt = `${userPrompt}\n${dialogSection}`
  }

  const images = senseResult.pendingMessages
    .filter((m): m is typeof m & { image: NonNullable<typeof m.image> } => m.image != null)
    .map((m) => ({ base64: m.image.base64, mimeType: m.image.mimeType }))

  const temperature = computeTemperatureFromMetacognition(feelResult.metacognitiveState)

  const callResult = await callIntelligence({
    system: systemPrompt,
    userMessage: userPrompt,
    schema: AnimaDecision,
    temperature,
    ...(images.length > 0 ? { images } : {})
  })

  if (callResult.isErr()) {
    captureError(callResult.error.cause, { phase: "deliberate" })
    log.warn("Deliberate LLM call failed, falling back to idle", { error: callResult.error.message })
    return {
      decision: {
        reasoning: "LLM call failed, defaulting to idle",
        messages: [],
        expectsReply: false,
        action: "idle",
        workflowId: null,
        corrections: []
      },
      systemPrompt,
      instinctOverride: false
    }
  }

  const decision = callResult.value

  log.info("Deliberate complete", {
    action: decision.action,
    messages: decision.messages.length,
    expectsReply: decision.expectsReply,
    reasoning: decision.reasoning
  })

  const cognitiveConflict = detectCognitiveConflict(feelResult.instinct, decision.action)

  const calendarChecked = calendarContext?.upcoming !== undefined
  const base = {
    decision,
    systemPrompt,
    innerDialog,
    cognitiveConflict,
    instinctOverride: false as const,
    calendarChecked
  }

  switch (decision.action) {
    case "dream":
      return { ...base, dreamResult: await thinkDream() }
    case "morning":
      return { ...base, morningResult: await thinkMorning(systemPrompt, feelResult.emotion, senseResult.moodContext) }
    case "reflect":
      return { ...base, reflectionResult: await thinkReflect(systemPrompt) }
    case "social_media":
      return { ...base, xTimeline: xContext?.timeline }
    default:
      return base
  }
}
