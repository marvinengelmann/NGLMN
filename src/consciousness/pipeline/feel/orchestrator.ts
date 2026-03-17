import type { SecondaryEmotionState } from "@/affect/emotion/types.ts"
import { applyEvent } from "@/affect/emotion/update.ts"
import { constrainVulnerabilityLevel } from "@/affect/soma/vagal.ts"
import { log } from "@/infra/lib/logger.ts"
import { isOperatorReturning } from "@/relational/attachment/update.ts"
import type { FeelingResult, SenseResult } from "../../types.ts"
import type { WriteBuffer } from "../persistence.ts"
import { assembleFeelOutput } from "./assemble.ts"
import { runEmotionChain } from "./chain.ts"
import { runFinalSubsystems } from "./final.ts"
import { runParallelSubsystems } from "./parallel.ts"
import { prefetchFeelState } from "./prefetch.ts"
import { runSecondaryEmotions } from "./secondary.ts"
import { stageAllFeelWrites } from "./staging.ts"
import { runVulnerabilityChain } from "./vulnerability.ts"

export async function runFeelPipeline(senseResult: SenseResult, buffer: WriteBuffer): Promise<FeelingResult> {
  const prefetch = await prefetchFeelState()

  const chain = await runEmotionChain(senseResult, prefetch)

  const parallel = await runParallelSubsystems(chain.emotion, chain.soma, senseResult, prefetch)

  let emotionAfterBoundary = chain.emotion
  emotionAfterBoundary = parallel.boundaryEmotionEvents.reduce(
    (acc, event) => applyEvent(acc, event),
    emotionAfterBoundary
  )

  const vulnerabilityResult = await runVulnerabilityChain(
    emotionAfterBoundary,
    chain.soma,
    senseResult,
    parallel,
    prefetch
  )

  vulnerabilityResult.vulnerability = {
    ...vulnerabilityResult.vulnerability,
    level: constrainVulnerabilityLevel(vulnerabilityResult.vulnerability.level, chain.vagalConstraints),
    windowOpen: vulnerabilityResult.vulnerability.windowOpen && chain.vagalConstraints.vulnerabilityAccess > 0.3
  }

  const operatorSilenceMinutes = senseResult.moodContext.operatorSilenceMinutes
  const operatorJustReturned = isOperatorReturning(senseResult.pendingMessages.length, operatorSilenceMinutes)

  const secondary = runSecondaryEmotions({
    emotion: emotionAfterBoundary,
    shameState: vulnerabilityResult.shameState,
    vulnerability: vulnerabilityResult.vulnerability,
    operatorModel: parallel.operatorModel,
    senseResult,
    operatorSilenceMinutes,
    selfDisclosureDepth: vulnerabilityResult.selfDisclosureDepth,
    operatorJustReturned,
    consecutiveIdleTicks: prefetch.consecutiveIdleTicks,
    consecutiveConversationTicks: prefetch.consecutiveConversationTicks,
    episodicHitCount: chain.episodicHits.length,
    inConversation: senseResult.moodContext.inConversation,
    pendingMessageCount: senseResult.pendingMessages.length,
    triggeredWorkflowCount: senseResult.triggeredWorkflows.length,
    isDreaming: senseResult.moodContext.isDreaming,
    noveltyLevel: parallel.noveltyState.level,
    anticipatoryViolations: parallel.anticipatoryState.recentViolations,
    previousSecondaryEmotionStates: prefetch.previousSecondaryEmotionStates,
    attachmentAnxiety: prefetch.attachmentStyle.anxious,
    attachmentSecure: prefetch.attachmentStyle.secure
  })

  const final = await runFinalSubsystems(
    secondary.emotion,
    chain.soma,
    chain.driveState,
    parallel.dissonance,
    vulnerabilityResult.vulnerability,
    vulnerabilityResult.shameState,
    vulnerabilityResult.heldBackBuffer,
    senseResult,
    prefetch,
    chain.vagalConstraints,
    parallel.isolationStress
  )

  stageAllFeelWrites(buffer, chain, parallel, vulnerabilityResult, secondary, final)

  const result = assembleFeelOutput(chain, parallel, vulnerabilityResult, secondary, final)

  const activeEmotions = Object.fromEntries(
    Object.entries(secondary.secondaryEmotions)
      .filter(([, state]) => (state as SecondaryEmotionState).isActive)
      .map(([name, state]) => [name, (state as SecondaryEmotionState).level.toFixed(2)])
  )

  log.info("Feel complete", {
    somaticTension: chain.soma.tension.toFixed(2),
    instinctImpulse: parallel.instinct.impulse,
    dissonance: parallel.dissonance.activeDissonance.toFixed(2),
    vulnerabilityOpen: vulnerabilityResult.vulnerability.windowOpen,
    shameActive: vulnerabilityResult.shameState.isActive,
    activeSecondaryEmotions: activeEmotions,
    heldBackEntries: vulnerabilityResult.heldBackBuffer.entries.length,
    suppressionPressure: vulnerabilityResult.heldBackBuffer.suppressionPressure.toFixed(2),
    register: final.register,
    attentionState: final.attentionState,
    operatorMood: parallel.operatorModel.estimatedMood
  })

  return result
}
