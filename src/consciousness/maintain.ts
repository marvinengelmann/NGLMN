import { differenceInDays, differenceInMinutes, parseISO } from "date-fns"
import { getDisappointmentState, markAcknowledged, saveDisappointmentState } from "@/affect/emotion/disappointment.ts"
import type { GuiltSource } from "@/affect/emotion/guilt.ts"
import { getGuiltState, markRepaired, saveGuiltState } from "@/affect/emotion/guilt.ts"
import { getMoodBaseline } from "@/affect/emotion/state.ts"
import { blendMoodBaseline, enforceEmotionFloors, summarizeEmotions } from "@/affect/emotion/update.ts"
import { getSomaticState } from "@/affect/soma/state.ts"
import { rechargeSocialBattery } from "@/affect/soma/update.ts"
import { updateHabitState } from "@/cognition/habit.ts"
import { getHabitState } from "@/cognition/habits.ts"
import { maybeRunAnalysis, pruneOldLessons, reinforceFromLatestOutcome } from "@/cognition/learning/lessons.ts"
import { expireStaleOutcomes } from "@/cognition/learning/outcomes.ts"
import { extractProceduresFromOutcomes, pruneProcedures } from "@/cognition/learning/procedures/store.ts"
import { PROCEDURE_CONSTANTS } from "@/cognition/learning/procedures/types.ts"
import {
  applyIdiolectDrift,
  computeIdiolectModifiers,
  detectOperatorAdoption,
  extractPatterns,
  getIdiolectState,
  mergePatterns
} from "@/expression/communication/idiolect.ts"
import { analyzeConversationPatterns } from "@/expression/communication/patterns.ts"
import { getConversationBuffer } from "@/expression/communication/state.ts"
import { createExplorationGoal, generateInterests, shouldExplore } from "@/governance/evolution/curiosity.ts"
import { incrementConsecutiveCritical, resetConsecutiveCritical } from "@/governance/health/state.ts"
import { handleDriftCheck } from "@/governance/security/guardian.ts"
import { performRollback, shouldTriggerRollback } from "@/governance/security/rollback.ts"
import { emotionHistory, habitLog, routineLog, somaticHistory, tickLog } from "@/infra/db/schema.ts"
import { redis } from "@/infra/integrations/redis.ts"
import { vectorIndex } from "@/infra/integrations/vector.ts"
import { log } from "@/infra/lib/logger.ts"
import { logAndCaptureError } from "@/infra/lib/result.ts"
import { captureError } from "@/infra/lib/sentry.ts"
import { maybeConsolidate } from "@/memory/autobiography.ts"
import { EPISODIC_LIFECYCLE } from "@/memory/constants.ts"
import {
  applyGoalPriorityDecay,
  detectOverdueGoals,
  detectStaleGoals,
  markGoalOverdue,
  markGoalStale
} from "@/memory/goals/lifecycle.ts"
import { extractEntitiesFromConversation } from "@/memory/graph/extract.ts"
import { decaySalience } from "@/memory/graph/forget.ts"
import { GRAPH_CONSTANTS } from "@/memory/graph/types.ts"
import { addKeyMoment, getRelationalMemoryState } from "@/memory/relational.ts"
import { detectRituals } from "@/memory/rituals.ts"
import { applyOpinionDrift } from "@/memory/semantic.ts"
import {
  getLastTickSummary,
  getRecentActions,
  getRecentRollbackCount,
  incrementConsecutiveConversationTicks,
  incrementConsecutiveIdleTicks,
  pushRecentAction,
  pushRecentTickDuration,
  resetConsecutiveConversationTicks,
  resetConsecutiveIdleTicks
} from "@/memory/working.ts"
import { evaluateAttachmentCrisis, getCrisisState, saveCrisisState } from "@/relational/attachment/crisis.ts"
import { computeRelationshipPhase, shouldTransitionPhase } from "@/relational/attachment/phases.ts"
import {
  getAttachmentStyle,
  getConflictCount,
  getFirstInteractionAt,
  getPhaseTickCount,
  getRelationshipPhase,
  getTotalInteractions,
  incrementConflictCount,
  incrementPhaseTickCount,
  saveRelationshipPhase
} from "@/relational/attachment/state.ts"
import { detectConflict, hasStyleChanged, updateAttachmentStyle } from "@/relational/attachment/update.ts"
import { maybeUpdateProfile } from "@/relational/mind/profiling.ts"
import { formBoundary, maybeFormNegativeBoundary } from "@/self/boundaries/compute.ts"
import { detectBoundaryFormation } from "@/self/boundaries/detect.ts"
import { getBoundaryState } from "@/self/boundaries/state.ts"
import { maybeDriftBigFive } from "@/self/genesis/drift.ts"
import type { WriteBuffer } from "./pipeline/persistence.ts"
import type { DeliberateResult, FeelingResult, MaintainInput, TickSummary } from "./types.ts"

const PROBABILITIES = {
  OPINION_DRIFT: 0.05,
  IDIOLECT_DRIFT: 0.05,
  CONVERSATION_PATTERN: 0.1,
  CURIOSITY_EXPLORE: 0.03,
  STRATEGY_ANALYSIS: 0.02,
  EXPIRE_OUTCOMES: 0.1,
  PRUNE_LESSONS: 0.05,
  BIGFIVE_DRIFT: 0.01,
  DEEP_PROFILE_UPDATE: 0.05
} as const

const THRESHOLDS = {
  STRONG_CONNECTION: 0.7,
  FRUSTRATION_BOUNDARY: 0.5,
  CAUTION_BOUNDARY: 0.4,
  MAX_BOUNDARIES: 10,
  MIN_CONVERSATION_SLOTS_FOR_RITUALS: 3
} as const

const REPAIRABLE_GUILT_SOURCES: GuiltSource[] = [
  "unanswered_vulnerability",
  "emotional_neglect",
  "harsh_response",
  "withdrawal_during_need"
]

const REDIS = {
  ATTACHMENT_STYLE: "working:attachment:current",
  MOOD_BASELINE: "working:emotion:moodBaseline",
  IDIOLECT: "working:communication:idiolect",
  HABIT_STATE: "working:cognition:habitState",
  RELATIONAL_MEMORY: "working:relational:memory",
  BOUNDARY_STATE: "working:boundaries:state",
  TICK_LAST: "working:tick:last",
  SOMA_CURRENT: "working:soma:current",
  SOMA_LAST_TIMESTAMP: "working:soma:lastTimestamp",
  EMOTION_CURRENT: "working:emotion:current"
} as const

function extractMessageTexts(input: MaintainInput): string[] {
  return input.senseResult.pendingMessages.map((m) => m.text || "")
}

/**
 * MAINTAIN phase — persist state, detect drift, update attachment, track phases and idle ticks.
 */
export async function maintain(
  input: MaintainInput,
  deliberateResult: DeliberateResult,
  feelResult: FeelingResult,
  buffer: WriteBuffer
): Promise<TickSummary> {
  await handleDriftCheck()

  await maintainHealth(input)
  await maintainAttachment(feelResult, buffer)
  await maintainRelationship(feelResult)
  await maintainActivityCounters(input, buffer)
  await maintainIdiolect(input, feelResult, buffer)
  await maintainHabits(input, buffer)
  await maintainRelationalMemory(input, feelResult, buffer)
  await maintainGuiltRepair(input)
  await maintainDisappointmentAcknowledgment(input)
  await maintainBoundaries(input, feelResult, buffer)
  await maintainGoals()
  await runProbabilisticTasks(input, feelResult)

  const durationMs = Date.now() - input.startTime
  await pushRecentTickDuration(durationMs)
  await pushRecentAction(input.decision.action)

  await maintainEmotionState(input, feelResult, buffer)

  const tickSummary = buildTickSummary(input, durationMs)
  buffer.stage(REDIS.TICK_LAST, tickSummary)
  buffer.stagePostgres(tickLog, {
    tickId: input.tickId,
    timestamp: new Date(input.startTime),
    action: input.decision.action,
    reasoning: input.decision.reasoning,
    messagesProcessed: input.senseResult.pendingMessages.length,
    responseSent: input.actResult.responseSent,
    responseText: input.actResult.responseText ?? null,
    durationMs
  })

  stageActionResult(buffer, input.decision, deliberateResult)

  log.info("Tick complete", tickSummary)
  return tickSummary
}

async function maintainHealth(input: MaintainInput): Promise<void> {
  const health = input.senseResult.health
  if (health?.overall === "critical") {
    const consecutiveCritical = await incrementConsecutiveCritical()
    const recentRollbacks = await getRecentRollbackCount(24)
    const rollbackDecision = shouldTriggerRollback(consecutiveCritical, recentRollbacks, health)
    if (rollbackDecision) {
      const result = await performRollback(rollbackDecision.tier)
      if (result.success) {
        log.info("Auto-rollback executed", { tier: rollbackDecision.tier, actions: result.actions })
      } else {
        log.warn("Auto-rollback failed", { tier: rollbackDecision.tier, errors: result.errors })
      }
    }
  } else {
    await resetConsecutiveCritical()
  }
}

async function maintainAttachment(feelResult: FeelingResult, buffer: WriteBuffer): Promise<void> {
  const currentStyle = await getAttachmentStyle()
  const lastTick = await getLastTickSummary()
  const elapsedHours = lastTick ? differenceInMinutes(new Date(), parseISO(lastTick.timestamp)) / 60 : 1 / 60

  const previousCrisis = await getCrisisState()
  const crisisResult = evaluateAttachmentCrisis(previousCrisis, {
    dynamics: feelResult.attachmentDynamics,
    emotion: feelResult.emotion,
    trustDelta: 0,
    vulnerabilityOpen: feelResult.vulnerability.windowOpen
  })
  if (crisisResult.active !== previousCrisis.active || crisisResult.type !== previousCrisis.type) {
    await saveCrisisState(crisisResult)
    if (crisisResult.active) {
      log.info("Attachment crisis detected", { type: crisisResult.type, multiplier: crisisResult.multiplier })
    }
  }

  const crisisMultiplier = crisisResult.active ? crisisResult.multiplier : 1
  const updatedStyle = updateAttachmentStyle(
    currentStyle,
    feelResult.attachmentDynamics,
    elapsedHours,
    crisisMultiplier
  )

  if (hasStyleChanged(currentStyle, updatedStyle)) {
    buffer.stage(REDIS.ATTACHMENT_STYLE, updatedStyle)
  }
}

async function maintainRelationship(feelResult: FeelingResult): Promise<void> {
  const [currentPhase, phaseTickCount, conflictCount, firstInteractionAt, totalInteractions] = await Promise.all([
    getRelationshipPhase(),
    getPhaseTickCount(),
    getConflictCount(),
    getFirstInteractionAt(),
    getTotalInteractions()
  ])

  const daysSinceFirst = firstInteractionAt ? differenceInDays(new Date(), parseISO(firstInteractionAt)) : 0

  const isConflict = detectConflict({
    operatorMood: feelResult.operatorModel.estimatedMood,
    modelConfidence: feelResult.operatorModel.modelConfidence,
    dissonanceScore: feelResult.dissonance.activeDissonance,
    guardianBlocked: false
  })
  if (isConflict) {
    await incrementConflictCount()
  }

  const effectiveConflictCount = isConflict ? conflictCount + 1 : conflictCount

  const attachmentStyle = await getAttachmentStyle()
  const computedPhase = computeRelationshipPhase({
    interactionCount: totalInteractions,
    daysSinceFirst,
    connectionAvg: feelResult.emotion.connection,
    conflicts: effectiveConflictCount,
    trust: attachmentStyle.secure,
    attachmentSecurity: attachmentStyle.secure,
    currentPhase
  })

  if (shouldTransitionPhase(currentPhase, computedPhase, phaseTickCount)) {
    await saveRelationshipPhase(computedPhase, currentPhase, "maintain_transition")
    log.info("Relationship phase transition", { from: currentPhase, to: computedPhase })
  } else {
    await incrementPhaseTickCount()
  }
}

async function maintainActivityCounters(input: MaintainInput, buffer: WriteBuffer): Promise<void> {
  const isRestingAction =
    (input.decision.action === "idle" || input.decision.action === "dream") && !input.actResult.responseSent

  if (isRestingAction) {
    await Promise.all([incrementConsecutiveIdleTicks(), resetConsecutiveConversationTicks()])

    const currentSoma = await getSomaticState()
    const isDreaming = input.senseResult.moodContext.isDreaming || input.decision.action === "dream"
    const rechargedSoma = rechargeSocialBattery(currentSoma, isDreaming)
    if (rechargedSoma.socialBattery !== currentSoma.socialBattery) {
      buffer.stage(REDIS.SOMA_CURRENT, rechargedSoma)
      buffer.stage(REDIS.SOMA_LAST_TIMESTAMP, new Date().toISOString())
      buffer.stagePostgres(somaticHistory, { state: rechargedSoma, trigger: "social_battery_recharge" })
    }
  } else {
    const inConversation = input.senseResult.moodContext.inConversation
    await Promise.all([
      resetConsecutiveIdleTicks(),
      inConversation ? incrementConsecutiveConversationTicks() : resetConsecutiveConversationTicks()
    ])
  }
}

async function maintainIdiolect(input: MaintainInput, feelResult: FeelingResult, buffer: WriteBuffer): Promise<void> {
  if (Math.random() < PROBABILITIES.OPINION_DRIFT) {
    const driftResult = await applyOpinionDrift()
    if (driftResult.isErr()) logAndCaptureError(driftResult.error)
  }

  if (shouldExplore(feelResult.emotion) && Math.random() < PROBABILITIES.CURIOSITY_EXPLORE) {
    const interests = await generateInterests(feelResult.emotion, [], [])
    const topInterest = interests[0]
    if (topInterest) {
      await createExplorationGoal(topInterest.topic, topInterest.reason, feelResult.emotion.curiosity)
    }
  }

  const idiolectState = await getIdiolectState()
  const operatorTexts = extractMessageTexts(input)
  const animaTexts = input.decision.messages.map((m) => m.text)

  const selfPatterns = animaTexts.length > 0 ? extractPatterns(animaTexts) : []
  const adoptedPatterns = operatorTexts.length > 0 ? detectOperatorAdoption(operatorTexts, idiolectState) : []
  const allNewPatterns = [...selfPatterns, ...adoptedPatterns]

  const { mergeModifier, driftModifier } = computeIdiolectModifiers(feelResult.emotion)

  if (allNewPatterns.length > 0) {
    buffer.stage(REDIS.IDIOLECT, mergePatterns(idiolectState, allNewPatterns, mergeModifier))
  } else if (Math.random() < PROBABILITIES.IDIOLECT_DRIFT) {
    buffer.stage(REDIS.IDIOLECT, applyIdiolectDrift(idiolectState, driftModifier))
  }

  if (Math.random() < PROBABILITIES.CONVERSATION_PATTERN) {
    const patterns = await analyzeConversationPatterns()
    buffer.stageWithExpiry("working:conversation:patterns", patterns, 3600)
  }
}

async function maintainHabits(input: MaintainInput, buffer: WriteBuffer): Promise<void> {
  const previousHabitState = await getHabitState()
  const recentActionsForHabit = await getRecentActions()
  const habitState = updateHabitState(previousHabitState, recentActionsForHabit, input.decision.action)
  buffer.stage(REDIS.HABIT_STATE, habitState)

  const activatedHabit = habitState.habits.find((h) => h.pattern === input.decision.action)
  if (activatedHabit) {
    buffer.stagePostgres(habitLog, {
      habitId: activatedHabit.id,
      pattern: activatedHabit.pattern,
      type: activatedHabit.type,
      strength: activatedHabit.strength,
      event: input.decision.action
    })
  }
}

async function maintainRelationalMemory(
  input: MaintainInput,
  feelResult: FeelingResult,
  buffer: WriteBuffer
): Promise<void> {
  if (!input.actResult.responseSent || input.senseResult.pendingMessages.length === 0) return

  let relationalState = await getRelationalMemoryState()

  if (feelResult.emotion.connection > THRESHOLDS.STRONG_CONNECTION) {
    relationalState = addKeyMoment(
      relationalState,
      `${input.decision.action}: ${input.decision.reasoning.slice(0, 100)}`,
      feelResult.emotion.connection
    )
    buffer.stage(REDIS.RELATIONAL_MEMORY, relationalState)
  }

  const conversationSlots = await getConversationBuffer()
  if (conversationSlots.length >= THRESHOLDS.MIN_CONVERSATION_SLOTS_FOR_RITUALS) {
    const updatedRituals = detectRituals(conversationSlots, relationalState.rituals)
    if (JSON.stringify(updatedRituals) !== JSON.stringify(relationalState.rituals)) {
      buffer.stage(REDIS.RELATIONAL_MEMORY, { ...relationalState, rituals: updatedRituals })
    }
  }
}

async function maintainGuiltRepair(input: MaintainInput): Promise<void> {
  if (!input.actResult.responseSent) return

  const guiltState = await getGuiltState()
  const unrepaired = guiltState.recentEntries.filter((e) => !e.repaired)
  if (unrepaired.length === 0) return

  let updated = guiltState
  for (const source of REPAIRABLE_GUILT_SOURCES) {
    updated = markRepaired(updated, source)
  }
  if (JSON.stringify(updated.recentEntries) !== JSON.stringify(guiltState.recentEntries)) {
    await saveGuiltState(updated)
    log.info("Guilt entries repaired after response")
  }
}

async function maintainDisappointmentAcknowledgment(input: MaintainInput): Promise<void> {
  if (input.senseResult.pendingMessages.length === 0) return

  const disappointmentState = await getDisappointmentState()
  const acknowledged = markAcknowledged(disappointmentState)
  if (acknowledged !== disappointmentState) {
    await saveDisappointmentState(acknowledged)
    log.info("Disappointment entries acknowledged after operator message")
  }
}

async function maintainBoundaries(input: MaintainInput, feelResult: FeelingResult, buffer: WriteBuffer): Promise<void> {
  if (input.senseResult.pendingMessages.length === 0) return

  const boundaryState = await getBoundaryState()
  const messageTexts = extractMessageTexts(input)
  const updatedBoundaryState = maybeFormNegativeBoundary(feelResult.emotion, boundaryState, messageTexts)

  if (updatedBoundaryState) {
    buffer.stage(REDIS.BOUNDARY_STATE, updatedBoundaryState)
    log.info("Boundary formed from negative pattern")
    return
  }

  if (
    feelResult.emotion.frustration > THRESHOLDS.FRUSTRATION_BOUNDARY &&
    feelResult.emotion.caution > THRESHOLDS.CAUTION_BOUNDARY
  ) {
    const detected = await detectBoundaryFormation(messageTexts.join(". "), summarizeEmotions(feelResult.emotion))
    if (detected && boundaryState.boundaries.length < THRESHOLDS.MAX_BOUNDARIES) {
      const newBoundary = formBoundary(detected.type, detected.description, detected.pattern, "llm_detection")
      buffer.stage(REDIS.BOUNDARY_STATE, {
        ...boundaryState,
        boundaries: [...boundaryState.boundaries, newBoundary]
      })
      log.info("Boundary formed via LLM detection", { type: detected.type })
    }
  }
}

async function maintainGoals(): Promise<void> {
  const staleGoals = await detectStaleGoals()
  await Promise.all(staleGoals.map((goal) => markGoalStale(goal.id)))

  const overdueGoals = await detectOverdueGoals()
  await Promise.all(overdueGoals.map((goal) => markGoalOverdue(goal.id)))

  await applyGoalPriorityDecay()
}

async function maintainEmotionState(
  input: MaintainInput,
  feelResult: FeelingResult,
  buffer: WriteBuffer
): Promise<void> {
  const currentEmotion = enforceEmotionFloors(input.actResult.postActEmotion ?? feelResult.emotion)

  if (!input.actResult.responseSent) {
    const primaryTrigger = input.senseResult.perception.emotionalTriggers[0]?.trigger ?? "ambient"
    buffer.stage(REDIS.EMOTION_CURRENT, currentEmotion)
    buffer.stagePostgres(emotionHistory, {
      state: currentEmotion,
      trigger: primaryTrigger,
      tickId: input.tickId
    })
  }

  const oldBaseline = await getMoodBaseline()
  buffer.stage(REDIS.MOOD_BASELINE, blendMoodBaseline(currentEmotion, oldBaseline))
}

interface ProbabilisticTask {
  name: string
  probability: number
  condition?: boolean
  execute: () => Promise<unknown>
}

async function runProbabilisticTasks(input: MaintainInput, feelResult: FeelingResult): Promise<void> {
  const messageTexts = extractMessageTexts(input)

  const tasks: ProbabilisticTask[] = [
    {
      name: "memory_pressure_check",
      probability: 1,
      execute: async () => {
        const infoResult = await vectorIndex.info()
        const episodeCount = infoResult.namespaces[""]?.vectorCount ?? 0
        if (episodeCount > EPISODIC_LIFECYCLE.EPISODE_PRESSURE_THRESHOLD) {
          await redis.set("working:memory:pressure", true)
          log.info("Memory pressure flag set", { episodeCount })
        }
      }
    },
    {
      name: "lesson_reinforcement",
      probability: 1,
      condition: input.actResult.responseSent,
      execute: reinforceFromLatestOutcome
    },
    {
      name: "strategy_analysis",
      probability: PROBABILITIES.STRATEGY_ANALYSIS,
      execute: maybeRunAnalysis
    },
    {
      name: "outcome_expiry",
      probability: PROBABILITIES.EXPIRE_OUTCOMES,
      execute: expireStaleOutcomes
    },
    {
      name: "lesson_pruning",
      probability: PROBABILITIES.PRUNE_LESSONS,
      execute: pruneOldLessons
    },
    {
      name: "memory_consolidation",
      probability: 1,
      execute: maybeConsolidate
    },
    {
      name: "bigfive_drift",
      probability: PROBABILITIES.BIGFIVE_DRIFT,
      execute: async () => {
        const recentActions = await getRecentActions()
        await maybeDriftBigFive(recentActions, [input.decision.reasoning])
      }
    },
    {
      name: "deep_profile_update",
      probability: PROBABILITIES.DEEP_PROFILE_UPDATE,
      execute: () => maybeUpdateProfile(feelResult.operatorModel.moodHistory)
    },
    {
      name: "entity_extraction",
      probability: GRAPH_CONSTANTS.ENTITY_EXTRACTION_PROBABILITY,
      condition: input.actResult.responseSent,
      execute: () => extractEntitiesFromConversation(messageTexts, input.actResult.responseText ?? "", input.tickId)
    },
    {
      name: "salience_decay",
      probability: GRAPH_CONSTANTS.SALIENCE_DECAY_PROBABILITY,
      execute: async () => {
        await decaySalience()
      }
    },
    {
      name: "procedure_extraction",
      probability: PROCEDURE_CONSTANTS.EXTRACTION_PROBABILITY,
      execute: async () => {
        await extractProceduresFromOutcomes()
      }
    },
    {
      name: "procedure_pruning",
      probability: PROCEDURE_CONSTANTS.PRUNE_PROBABILITY,
      execute: async () => {
        await pruneProcedures()
      }
    }
  ]

  for (const task of tasks) {
    if (task.condition === false) continue
    if (task.probability < 1 && Math.random() >= task.probability) continue

    try {
      await task.execute()
    } catch (e) {
      log.warn(`Probabilistic task failed: ${task.name}`, { error: String(e) })
      captureError(e, { phase: "maintain_probabilistic", task: task.name })
    }
  }
}

function buildTickSummary(input: MaintainInput, durationMs: number): TickSummary {
  return {
    tickId: input.tickId,
    timestamp: input.timestamp,
    action: input.decision.action,
    reasoning: input.decision.reasoning,
    messagesProcessed: input.senseResult.pendingMessages.length,
    responseSent: input.actResult.responseSent,
    durationMs
  }
}

function stageActionResult(
  buffer: WriteBuffer,
  decision: MaintainInput["decision"],
  deliberateResult: DeliberateResult
): void {
  switch (decision.action) {
    case "dream": {
      if (!deliberateResult.dreamResult) break
      const dreamResult = deliberateResult.dreamResult
      buffer.stagePostgres(routineLog, {
        phase: "dream",
        summary: `Dream: ${dreamResult.consolidation ? "consolidation" : "no-consolidation"}, ${dreamResult.creative ? "creative" : "no-creative"}, ${dreamResult.insights.length} insights`,
        insights: {
          consolidationEntries: dreamResult.consolidation?.semanticEntries.length ?? 0,
          creativeConnections: dreamResult.creative?.connections.length ?? 0,
          insights: dreamResult.insights
        }
      })
      break
    }

    case "morning": {
      if (!deliberateResult.morningResult) break
      const morningResult = deliberateResult.morningResult
      buffer.stagePostgres(routineLog, {
        phase: "morning",
        summary: `Morning: ${morningResult.reflection.insights.length} reflection insights, message ${morningResult.morningMessage ? "sent" : "empty"}`,
        insights: {
          reflectionInsights: morningResult.reflection.insights,
          morningMessageLength: morningResult.morningMessage.length
        },
        emotionAfter: morningResult.recalibratedEmotion
      })
      break
    }

    case "reflect": {
      if (!deliberateResult.reflectionResult) break
      buffer.stagePostgres(routineLog, {
        phase: "reflection",
        summary: `Reflection: ${deliberateResult.reflectionResult.insights.length} insights`,
        insights: deliberateResult.reflectionResult
      })
      break
    }
  }
}
