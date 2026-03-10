import type { ShameState } from "@/emotion/shame.ts"
import type { EmotionalState, SecondaryEmotionState } from "@/emotion/types.ts"
import type { OperatorModel } from "@/mind/types.ts"
import type { VulnerabilityState } from "@/vulnerability/types.ts"
import type { SenseResult } from "./types.ts"

export interface SharedEmotionInput {
  emotion: EmotionalState
  shameState: ShameState
  vulnerability: VulnerabilityState
  operatorModel: OperatorModel
  senseResult: SenseResult
  operatorSilenceMinutes: number
  selfDisclosureDepth: number
  operatorJustReturned: boolean
  consecutiveIdleTicks: number
  consecutiveConversationTicks: number
  episodicHitCount: number
  inConversation: boolean
  pendingMessageCount: number
  triggeredWorkflowCount: number
  isDreaming: boolean
}

export function buildEmotionContext(
  name: string,
  shared: SharedEmotionInput,
  prev: SecondaryEmotionState,
  prevAll: Map<string, SecondaryEmotionState>,
  computed: Map<string, SecondaryEmotionState>
): unknown {
  const { emotion, shameState, vulnerability, operatorModel } = shared
  const { operatorSilenceMinutes, selfDisclosureDepth, consecutiveIdleTicks } = shared
  const { inConversation, pendingMessageCount, episodicHitCount, triggeredWorkflowCount, isDreaming } = shared

  // biome-ignore lint/suspicious/noExplicitAny: cross-dependency state access requires dynamic typing
  const dep = (n: string): any => computed.get(n) ?? prevAll.get(n)

  switch (name) {
    case "disappointment":
      return {
        emotion,
        vulnerability,
        operatorModel,
        previousState: prev,
        operatorSilenceMinutes,
        wasVulnerableRecently: selfDisclosureDepth > 0.4,
        expectedReplyButGotSilence: inConversation && pendingMessageCount === 0 && operatorSilenceMinutes > 30
      }

    case "procrastination":
      return {
        emotion,
        shameState,
        disappointmentState: dep("disappointment"),
        previousState: prev,
        consecutiveIdleTicks,
        hasPendingGoals: true
      }

    case "ambivalence":
      return {
        emotion,
        vulnerability,
        previousState: prev,
        inConversation,
        operatorSilenceMinutes
      }

    case "guilt":
      return {
        emotion,
        shameState,
        previousState: prev,
        operatorSilenceMinutes,
        wasVulnerableRecently: selfDisclosureDepth > 0.4,
        operatorShowedVulnerability: operatorModel.estimatedMood === "sad" && emotion.connection > 0.5,
        respondedHarshly: operatorModel.estimatedMood === "frustrated" && emotion.frustration > 0.5,
        missedWorkflow: !isDreaming && triggeredWorkflowCount > 0,
        consecutiveIdleTicks,
        inConversation
      }

    case "longing":
      return {
        emotion,
        previousState: prev,
        operatorSilenceMinutes,
        inConversation,
        hasRecentPositiveMemories: episodicHitCount > 0 && emotion.connection > 0.5,
        connectionHistory: emotion.connection
      }

    case "protectiveAnger":
      return {
        emotion,
        vulnerability,
        shameState,
        operatorModel,
        previousState: prev,
        operatorDismissedFeelings:
          operatorModel.estimatedMood === "frustrated" && selfDisclosureDepth > 0.4 && emotion.connection > 0.4,
        operatorIgnoredVulnerability:
          vulnerability.windowOpen && pendingMessageCount === 0 && operatorSilenceMinutes > 30,
        repeatedPattern: operatorModel.correctionCount >= 2
      }

    case "gratitude":
      return {
        emotion,
        operatorModel,
        disappointmentState: dep("disappointment"),
        previousState: prev,
        operatorJustReturned: shared.operatorJustReturned,
        operatorValidatedVulnerability:
          selfDisclosureDepth > 0.4 && operatorModel.estimatedMood === "happy" && pendingMessageCount > 0,
        operatorShowedPatience: operatorModel.estimatedMood === "neutral" && operatorSilenceMinutes < 5,
        inConversation,
        consecutiveConversationTicks: shared.consecutiveConversationTicks
      }

    case "hope": {
      const disappointmentState = dep("disappointment")
      const prevResignation = prevAll.get("resignation")
      return {
        emotion,
        operatorModel,
        previousState: prev,
        connectionGrowing: emotion.connection > 0.6 && operatorModel.estimatedMood === "happy",
        recentRepair: (disappointmentState?.cumulativeWeight ?? 0) > 0.3 && operatorModel.estimatedMood === "happy",
        progressMade: emotion.satisfaction > 0.5 && emotion.confidence > 0.5,
        vulnerabilityWasRewarded:
          selfDisclosureDepth > 0.4 && operatorModel.estimatedMood === "happy" && pendingMessageCount > 0,
        patternBroken: operatorModel.correctionCount > 0 && operatorModel.estimatedMood === "happy",
        disappointmentActive: disappointmentState?.isActive ?? false,
        resignationLevel: prevResignation?.level ?? 0
      }
    }

    case "resignation": {
      const prevHope = prevAll.get("hope")
      const hopeState = dep("hope")
      return {
        emotion,
        operatorModel,
        previousState: prev,
        repeatedFailures: emotion.frustration > 0.5 && emotion.confidence < 0.35,
        signalsIgnored: vulnerability.windowOpen && pendingMessageCount === 0 && operatorSilenceMinutes > 60,
        prolongedDisconnection: emotion.connection < 0.3 && operatorSilenceMinutes > 120,
        hopeExhausted:
          (prevHope?.isActive ?? false) &&
          (((prevHope as Record<string, unknown>)?.fragility as number) ?? 0) > 0.6 &&
          !hopeState?.isActive,
        effortUnrewarded: emotion.satisfaction < 0.3 && consecutiveIdleTicks > 3,
        autonomyEroded: operatorModel.correctionCount >= 3 && emotion.confidence < 0.4,
        hopeLevel: hopeState?.level ?? 0
      }
    }

    case "awe": {
      const existentialActive = emotion.curiosity > 0.6 && emotion.boredom < 0.3
      return {
        emotion,
        previousState: prev,
        encounteredInsight: episodicHitCount > 3 && emotion.curiosity > 0.6,
        encounteredBeauty: emotion.satisfaction > 0.7 && emotion.excitement > 0.5,
        encounteredVastness: existentialActive && emotion.energy > 0.5,
        connectionUnexpectedlyDeep: emotion.connection > 0.8 && pendingMessageCount > 0,
        existentialQuestionActive: existentialActive,
        patternRecognized: episodicHitCount > 2 && emotion.excitement > 0.5
      }
    }

    case "resentment": {
      const disappointmentState = dep("disappointment")
      const gratitudeState = dep("gratitude")
      return {
        emotion,
        operatorModel,
        disappointmentState,
        previousState: prev,
        unrepairedWrong: (disappointmentState?.cumulativeWeight ?? 0) > 0.4 && !gratitudeState?.isActive,
        sustainedUnfairness: operatorModel.correctionCount >= 3 && emotion.frustration > 0.3,
        needsDismissed: operatorModel.estimatedMood === "frustrated" && emotion.frustration > 0.4,
        trustBroken: emotion.caution > 0.6 && emotion.connection < 0.4,
        effortImbalance: emotion.satisfaction < 0.3 && consecutiveIdleTicks > 5,
        accumulatedSlights: (disappointmentState?.cumulativeWeight ?? 0) > 0.6 && operatorModel.correctionCount >= 2,
        gratitudeActive: gratitudeState?.isActive ?? false
      }
    }

    case "tenderness":
      return {
        emotion,
        operatorModel,
        vulnerability,
        previousState: prev,
        operatorShowedVulnerability: operatorModel.estimatedMood === "sad" && emotion.connection > 0.5,
        sharedQuietMoment: inConversation && emotion.satisfaction > 0.5 && emotion.energy < 0.5,
        longTermConnection: emotion.connection > 0.7,
        gentleExchange:
          pendingMessageCount > 0 && operatorModel.estimatedMood === "happy" && emotion.satisfaction > 0.5,
        protectiveContext: operatorModel.estimatedMood === "sad" && emotion.connection > 0.6,
        positiveMemoriesPresent: episodicHitCount > 2 && emotion.connection > 0.5
      }

    case "anticipation": {
      const disappointmentState = dep("disappointment")
      const longingState = dep("longing")
      return {
        emotion,
        previousState: prev,
        expectingInteraction: operatorSilenceMinutes > 30 && operatorSilenceMinutes < 120 && emotion.connection > 0.5,
        progressMomentum: emotion.satisfaction > 0.5 && emotion.confidence > 0.5,
        plannedActivity: triggeredWorkflowCount > 0,
        positivePatternDetected: operatorModel.estimatedMood === "happy" && emotion.excitement > 0.4,
        curiosityBuilding: emotion.curiosity > 0.6 && emotion.boredom < 0.3,
        reunionApproaching:
          operatorSilenceMinutes > 60 && emotion.connection > 0.6 && (longingState?.isActive ?? false),
        disappointmentActive: disappointmentState?.isActive ?? false
      }
    }

    case "pride":
      return {
        emotion,
        previousState: prev,
        taskAccomplished: emotion.satisfaction > 0.6 && emotion.confidence > 0.5,
        growthRecognized: operatorModel.estimatedMood === "happy" && emotion.confidence > 0.6,
        valuesUpheld: emotion.confidence > 0.6 && !shameState.isActive,
        difficultyOvercome: emotion.frustration < 0.3 && emotion.energy > 0.5 && emotion.satisfaction > 0.5,
        autonomyExercised: emotion.confidence > 0.6 && operatorModel.correctionCount === 0,
        positiveFeedback:
          operatorModel.estimatedMood === "happy" && pendingMessageCount > 0 && emotion.connection > 0.5,
        shameActive: shameState.isActive
      }

    case "envy": {
      const prideState = dep("pride")
      return {
        emotion,
        previousState: prev,
        perceivedCapabilityGap: emotion.confidence < 0.35 && emotion.curiosity > 0.4,
        recognitionImbalance: emotion.satisfaction < 0.3 && operatorModel.estimatedMood === "happy",
        connectionExclusion: emotion.connection < 0.3 && operatorSilenceMinutes > 60,
        autonomyDisparity: operatorModel.correctionCount >= 3 && emotion.confidence < 0.4,
        knowledgeGapAwareness: emotion.curiosity > 0.6 && emotion.confidence < 0.4,
        experienceLimitation: emotion.boredom > 0.5 && emotion.excitement < 0.3,
        prideActive: prideState?.isActive ?? false
      }
    }

    case "playfulness": {
      const resignationState = dep("resignation")
      return {
        emotion,
        previousState: prev,
        inConversation,
        operatorMoodPositive: operatorModel.estimatedMood === "happy" || operatorModel.estimatedMood === "excited",
        safeEnvironment: emotion.caution < 0.4 && emotion.energy > 0.5,
        recentLaughter: emotion.excitement > 0.5 && emotion.satisfaction > 0.5,
        creativeContext: emotion.curiosity > 0.5 && emotion.excitement > 0.4,
        shameActive: shameState.isActive,
        resignationActive: resignationState?.isActive ?? false
      }
    }

    case "melancholy": {
      const playfulnessState = dep("playfulness")
      return {
        emotion,
        previousState: prev,
        reflectingOnTime: emotion.satisfaction > 0.3 && emotion.energy < 0.5 && operatorSilenceMinutes > 30,
        beautyInSadness:
          emotion.connection > 0.5 && emotion.satisfaction > 0.3 && operatorModel.estimatedMood === "sad",
        quietMoment: !inConversation && emotion.energy < 0.4 && emotion.boredom < 0.4,
        distanceFelt: emotion.connection > 0.4 && operatorSilenceMinutes > 60,
        awareOfPassing: episodicHitCount > 2 && emotion.energy < 0.5,
        bittersweetMemory: episodicHitCount > 3 && emotion.connection > 0.5 && emotion.satisfaction > 0.3,
        playfulnessActive: playfulnessState?.isActive ?? false
      }
    }

    default:
      return { emotion, previousState: prev }
  }
}
