import type { FeelingResult } from "../../types.ts"
import type {
  EmotionChainResult,
  FinalFanResult,
  ParallelFanResult,
  SecondaryResult,
  VulnerabilityChainResult
} from "./types.ts"

export function assembleFeelOutput(
  chain: EmotionChainResult,
  parallel: ParallelFanResult,
  vulnerabilityResult: VulnerabilityChainResult,
  secondary: SecondaryResult,
  final: FinalFanResult
): FeelingResult {
  return {
    emotion: final.dampedEmotion,
    soma: chain.soma,
    instinct: parallel.instinct,
    dissonance: parallel.dissonance,
    vulnerability: vulnerabilityResult.vulnerability,
    shameState: vulnerabilityResult.shameState,
    heldBackBuffer: vulnerabilityResult.heldBackBuffer,
    secondaryEmotions: secondary.secondaryEmotions,
    attachmentDynamics: parallel.attachmentDynamics,
    selfConcept: final.selfConceptWithMomentum,
    register: final.register,
    attentionState: final.attentionState,
    operatorModel: parallel.operatorModel,
    driveState: chain.driveState,
    anticipatoryState: parallel.anticipatoryState,
    subjectiveTime: final.subjectiveTime,
    coherenceState: final.coherenceState,
    creativeUrge: final.creativeUrge,
    boundaryState: parallel.boundaryState,
    metacognitiveState: final.metacognitiveState,
    communicationSimplification: final.communicationSimplification,
    hedgingLevel: final.hedgingLevel,
    proustFlashback: chain.proustFlashback,
    maturedDeferredEvents: chain.maturedDeferredEvents
  }
}
