import { computeVoiceModifiers } from "@/altered/compute.ts"
import { getActiveAlteredState } from "@/altered/state.ts"
import { detectCognitiveConflict, shouldInstinctOverride } from "@/cognition/override.ts"
import { ATTENTION, CALENDAR, SOCIAL_MEDIA } from "@/config/constants.ts"
import { env } from "@/config/env.ts"
import { callIntelligence } from "@/core/intelligence.ts"
import { thinkDream } from "@/dream/thinking.ts"
import { fetchUpcomingEvents, isCaldavEnabled } from "@/integrations/caldav.ts"
import { fetchUnreadEmails, isImapEnabled } from "@/integrations/imap.ts"
import type { CalendarEvent, EmailPreview, XPost } from "@/integrations/types.ts"
import { getHomeTimeline, isXEnabled } from "@/integrations/x.ts"
import { log } from "@/lib/logger.ts"
import { captureError } from "@/lib/sentry.ts"
import { queryRelated } from "@/memory/episodic.ts"
import { getGoalsByPriority } from "@/memory/goals.ts"
import {
  canCheckCalendar,
  canCheckEmail,
  canPerformSocialMedia,
  getConsecutiveIdleTicks,
  setCalendarLastCheck
} from "@/memory/working.ts"
import { getOperatorProfile } from "@/mind/profile.ts"
import { generateInnerDialog } from "@/polyphony/dialog.ts"
import { selectActiveVoices, shouldRunDialog } from "@/polyphony/voices.ts"
import { getStructuredExistentialQuestions } from "@/psyche/questions.ts"
import { thinkMorning, thinkReflect } from "@/routine/thinking.ts"
import { generateContextualImpulse } from "./boredom.ts"
import { buildContext, buildSystemPrompt } from "./context.ts"
import { AnimaDecision, type DeliberateResult, type FeelingResult, type SenseData, type SenseResult } from "./types.ts"

/**
 * DELIBERATE phase — main LLM decision with polyphony and instinct integration.
 */
export async function deliberate(senseResult: SenseResult, feelResult: FeelingResult): Promise<DeliberateResult> {
  const senseData: SenseData = {
    pendingMessages: senseResult.pendingMessages,
    perception: senseResult.perception,
    health: senseResult.health,
    weather: senseResult.perception.weatherData ?? null,
    conversationState: senseResult.conversationState,
    triggeredWorkflows: senseResult.triggeredWorkflows,
    moodContext: senseResult.moodContext
  }
  let xContext: { canBrowse: boolean; canPost: boolean; timeline?: XPost[] } | undefined
  if (isXEnabled()) {
    const socialStatus = await canPerformSocialMedia()
    let timeline: XPost[] | undefined
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
        log.warn("Failed to pre-fetch emails", { error: e instanceof Error ? e.message : String(e) })
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
        await setCalendarLastCheck(new Date().toISOString())
      } catch (e) {
        log.warn("Failed to pre-fetch calendar", { error: e instanceof Error ? e.message : String(e) })
        calendarContext = { canCheck: true }
      }
    } else {
      calendarContext = { canCheck: false }
    }
  }

  const contextString = await buildContext(senseData, feelResult.emotion, xContext, emailContext, calendarContext)
  const systemPrompt = buildSystemPrompt(contextString)

  const alteredState = await getActiveAlteredState()
  const alteredVoiceModifiers = alteredState ? computeVoiceModifiers(alteredState) : undefined

  const activeVoices = selectActiveVoices(
    feelResult.emotion,
    env().PERSONALITY_TYPE,
    {
      dissonanceScore: feelResult.dissonance.activeDissonance,
      action: "pending",
      hasMessages: senseResult.pendingMessages.length > 0
    },
    alteredVoiceModifiers
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

  const consecutiveIdle = await getConsecutiveIdleTicks()
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

  const callResult = await callIntelligence({
    system: systemPrompt,
    userMessage: userPrompt,
    schema: AnimaDecision,
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

  const base = { decision, systemPrompt, innerDialog, cognitiveConflict, instinctOverride: false as const }

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
