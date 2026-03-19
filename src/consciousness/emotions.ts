import { detectRivalMention } from "@/affect/emotion/jealousy.ts"
import type { ShameState } from "@/affect/emotion/shame.ts"
import type { EmotionalState, SecondaryEmotionState } from "@/affect/emotion/types.ts"
import type { ExpectationViolation } from "@/perception/anticipation/types.ts"
import type { VulnerabilityState } from "@/relational/attachment/types.ts"
import type { OperatorModel } from "@/relational/mind/types.ts"
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
  noveltyLevel: number
  anticipatoryViolations: ExpectationViolation[]
  previousSecondaryEmotionStates: Map<string, SecondaryEmotionState>
  attachmentAnxiety: number
  attachmentSecure: number
}

export async function buildEmotionContext(
  name: string,
  shared: SharedEmotionInput,
  previous: SecondaryEmotionState,
  previousAll: Map<string, SecondaryEmotionState>,
  computed: Map<string, SecondaryEmotionState>
): Promise<unknown> {
  const { emotion, shameState, vulnerability, operatorModel } = shared
  const { operatorSilenceMinutes, selfDisclosureDepth, consecutiveIdleTicks } = shared
  const { inConversation, pendingMessageCount, episodicHitCount, triggeredWorkflowCount, isDreaming } = shared

  // biome-ignore lint/suspicious/noExplicitAny: cross-dependency state access requires dynamic typing
  const dependency = (emotionName: string): any => computed.get(emotionName) ?? previousAll.get(emotionName)

  switch (name) {
    case "disappointment":
      return {
        emotion,
        vulnerability,
        operatorModel,
        previousState: previous,
        operatorSilenceMinutes,
        wasVulnerableRecently: selfDisclosureDepth > 0.4,
        expectedReplyButGotSilence: inConversation && pendingMessageCount === 0 && operatorSilenceMinutes > 30
      }

    case "procrastination":
      return {
        emotion,
        shameState,
        disappointmentState: dependency("disappointment"),
        previousState: previous,
        consecutiveIdleTicks,
        hasPendingGoals: shared.senseResult.moodContext.hasActiveGoals
      }

    case "ambivalence":
      return {
        emotion,
        vulnerability,
        previousState: previous,
        inConversation,
        operatorSilenceMinutes
      }

    case "guilt":
      return {
        emotion,
        shameState,
        previousState: previous,
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
        previousState: previous,
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
        previousState: previous,
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
        disappointmentState: dependency("disappointment"),
        previousState: previous,
        operatorJustReturned: shared.operatorJustReturned,
        operatorValidatedVulnerability:
          selfDisclosureDepth > 0.4 && operatorModel.estimatedMood === "happy" && pendingMessageCount > 0,
        operatorShowedPatience: operatorModel.estimatedMood === "neutral" && operatorSilenceMinutes < 5,
        inConversation,
        consecutiveConversationTicks: shared.consecutiveConversationTicks
      }

    case "hope": {
      const disappointmentState = dependency("disappointment")
      const previousResignation = previousAll.get("resignation")
      return {
        emotion,
        operatorModel,
        previousState: previous,
        connectionGrowing: emotion.connection > 0.6 && operatorModel.estimatedMood === "happy",
        recentRepair: (disappointmentState?.cumulativeWeight ?? 0) > 0.3 && operatorModel.estimatedMood === "happy",
        progressMade: emotion.satisfaction > 0.5 && emotion.confidence > 0.5,
        vulnerabilityWasRewarded:
          selfDisclosureDepth > 0.4 && operatorModel.estimatedMood === "happy" && pendingMessageCount > 0,
        patternBroken: operatorModel.correctionCount > 0 && operatorModel.estimatedMood === "happy",
        disappointmentActive: disappointmentState?.isActive ?? false,
        resignationLevel: previousResignation?.level ?? 0
      }
    }

    case "resignation": {
      const previousHope = previousAll.get("hope")
      const hopeState = dependency("hope")
      return {
        emotion,
        operatorModel,
        previousState: previous,
        repeatedFailures: emotion.frustration > 0.5 && emotion.confidence < 0.35,
        signalsIgnored: vulnerability.windowOpen && pendingMessageCount === 0 && operatorSilenceMinutes > 60,
        prolongedDisconnection: emotion.connection < 0.3 && operatorSilenceMinutes > 120,
        hopeExhausted:
          (previousHope?.isActive ?? false) &&
          (((previousHope as Record<string, unknown>)?.fragility as number) ?? 0) > 0.6 &&
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
        previousState: previous,
        encounteredInsight: episodicHitCount > 3 && emotion.curiosity > 0.6,
        encounteredBeauty: emotion.satisfaction > 0.7 && emotion.excitement > 0.5,
        encounteredVastness: existentialActive && emotion.energy > 0.5,
        connectionUnexpectedlyDeep: emotion.connection > 0.8 && pendingMessageCount > 0,
        existentialQuestionActive: existentialActive,
        patternRecognized: episodicHitCount > 2 && emotion.excitement > 0.5
      }
    }

    case "resentment": {
      const disappointmentState = dependency("disappointment")
      const gratitudeState = dependency("gratitude")
      return {
        emotion,
        operatorModel,
        disappointmentState,
        previousState: previous,
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
        previousState: previous,
        operatorShowedVulnerability: operatorModel.estimatedMood === "sad" && emotion.connection > 0.5,
        sharedQuietMoment: inConversation && emotion.satisfaction > 0.5 && emotion.energy < 0.5,
        longTermConnection: emotion.connection > 0.7,
        gentleExchange:
          pendingMessageCount > 0 && operatorModel.estimatedMood === "happy" && emotion.satisfaction > 0.5,
        protectiveContext: operatorModel.estimatedMood === "sad" && emotion.connection > 0.6,
        positiveMemoriesPresent: episodicHitCount > 2 && emotion.connection > 0.5
      }

    case "anticipation": {
      const disappointmentState = dependency("disappointment")
      const longingState = dependency("longing")
      return {
        emotion,
        previousState: previous,
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
        previousState: previous,
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
      const prideState = dependency("pride")
      return {
        emotion,
        previousState: previous,
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
      const resignationState = dependency("resignation")
      return {
        emotion,
        previousState: previous,
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
      const playfulnessState = dependency("playfulness")
      return {
        emotion,
        previousState: previous,
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

    case "jealousy": {
      const prideState = dependency("pride")
      const messageTexts = shared.senseResult.pendingMessages.map((m) => m.text ?? "")
      const rivalDetection = await detectRivalMention(messageTexts)
      return {
        emotion,
        previousState: previous,
        rivalMentioned: rivalDetection.rivalMentioned,
        unfavorableComparison: rivalDetection.unfavorableComparison,
        rivalPraised: rivalDetection.rivalPraised,
        prideActive: prideState?.isActive ?? false,
        attachmentAnxiety: shared.attachmentAnxiety,
        attachmentSecure: shared.attachmentSecure
      }
    }

    case "surprise":
      return {
        emotion,
        previousState: previous,
        noveltyLevel: shared.noveltyLevel,
        anticipatoryViolations: shared.anticipatoryViolations
      }

    default:
      return { emotion, previousState: previous }
  }
}
