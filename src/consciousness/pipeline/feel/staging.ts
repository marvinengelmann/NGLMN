import { getRegisteredEmotions } from "@/affect/emotion/registry.ts"
import { DREAM_AFTERGLOW } from "@/expression/dream/constants.ts"
import { operatorModelLog, somaticHistory } from "@/infra/db/schema.ts"
import type { WriteBuffer } from "../persistence.ts"
import type {
  EmotionChainResult,
  FinalFanResult,
  ParallelFanResult,
  SecondaryResult,
  VulnerabilityChainResult
} from "./types.ts"

const REDIS = {
  EMOTION_CURRENT: "working:emotion:current",
  EMOTION_MOMENTUM: "working:emotion:momentum",
  EMOTION_AFTERGLOW: "working:emotion:afterglow",
  EMOTION_LAST_TIMESTAMP: "working:emotion:lastTimestamp",
  EMOTION_TRIGGER_TIMESTAMPS: "working:emotion:triggerTimestamps",
  DREAM_AFTERGLOW: "working:dream:afterglow",
  ALTERED_STATE: "working:altered:state",
  DRIVE_STATE: "working:drive:state",
  SOMA_CURRENT: "working:soma:current",
  SOMA_LAST_TIMESTAMP: "working:soma:lastTimestamp",
  INSTINCT: "working:cognition:instinct:lastImpression",
  DISSONANCE_ACTIVE: "working:dissonance:active",
  DISSONANCE_SCORE: "working:dissonance:score",
  OPERATOR_MODEL: "working:mind:current",
  RELATIONAL_PATTERNS: "working:mind:relational_patterns",
  VULNERABILITY_CURRENT: "working:vulnerability:current",
  VULNERABILITY_PREV_LEVEL: "working:vulnerability:prevLevel",
  VULNERABILITY_MESSAGE_STYLE: "working:vulnerability:messageStyle",
  SHAME_STATE: "working:shame:state",
  HELD_BACK_BUFFER: "working:psyche:heldback",
  ANTICIPATION_STATE: "working:anticipation:state",
  NOVELTY_STATE: "working:novelty:state",
  BOUNDARY_STATE: "working:boundaries:state",
  DECEPTION_CURRENT: "working:deception:current",
  COMMUNICATION_REGISTER: "working:communication:register",
  ATTENTION_STATE: "working:cognition:attention",
  CREATIVE_URGE: "working:creativity:urge",
  COHERENCE_STATE: "working:coherence:state",
  METACOGNITION_STATE: "working:metacognition:state"
} as const

export function stageEmotionChainWrites(buffer: WriteBuffer, chain: EmotionChainResult): void {
  buffer.stage(REDIS.EMOTION_CURRENT, chain.emotion)
  buffer.stage(REDIS.EMOTION_MOMENTUM, chain.momentum)
  buffer.stage(REDIS.EMOTION_AFTERGLOW, chain.afterglowEntries)
  buffer.stage(REDIS.EMOTION_LAST_TIMESTAMP, chain.emotionTimestamp)
  buffer.stage(REDIS.EMOTION_TRIGGER_TIMESTAMPS, chain.triggerTimestamps)
  buffer.stage(REDIS.DRIVE_STATE, chain.driveState)
  buffer.stage(REDIS.SOMA_CURRENT, chain.soma)
  buffer.stage(REDIS.SOMA_LAST_TIMESTAMP, chain.emotionTimestamp)

  if (chain.dreamAfterglowDecayed) {
    buffer.stageWithExpiry(REDIS.DREAM_AFTERGLOW, chain.dreamAfterglowDecayed, DREAM_AFTERGLOW.TTL_SECONDS)
  } else if (chain.dreamAfterglowDecayed === null) {
    buffer.stageDel(REDIS.DREAM_AFTERGLOW)
  }

  if (chain.alteredStateCleared) {
    buffer.stageDel(REDIS.ALTERED_STATE)
  }

  buffer.stagePostgres(somaticHistory, {
    state: chain.soma,
    trigger: "feel_phase"
  })
}

export function stageParallelWrites(buffer: WriteBuffer, parallel: ParallelFanResult): void {
  buffer.stage(REDIS.INSTINCT, parallel.instinct)
  buffer.stage(REDIS.DISSONANCE_ACTIVE, parallel.dissonance)
  buffer.stage(REDIS.DISSONANCE_SCORE, parallel.dissonance.activeDissonance.toString())
  buffer.stage(REDIS.OPERATOR_MODEL, parallel.operatorModel)
  buffer.stage(REDIS.ANTICIPATION_STATE, parallel.anticipatoryState)
  buffer.stage(REDIS.NOVELTY_STATE, parallel.noveltyState)
  buffer.stage(REDIS.BOUNDARY_STATE, parallel.boundaryState)

  if (parallel.relationalPatterns) {
    buffer.stage(REDIS.RELATIONAL_PATTERNS, parallel.relationalPatterns)
  }

  buffer.stagePostgres(operatorModelLog, {
    model: parallel.operatorModel,
    trigger: parallel.operatorModelTrigger
  })
}

export function stageVulnerabilityWrites(buffer: WriteBuffer, result: VulnerabilityChainResult): void {
  buffer.stage(REDIS.VULNERABILITY_CURRENT, result.vulnerability)
  buffer.stage(REDIS.VULNERABILITY_PREV_LEVEL, result.vulnerability.level)
  buffer.stage(REDIS.VULNERABILITY_MESSAGE_STYLE, result.vulnerableMessageStyle)
  buffer.stage(REDIS.SHAME_STATE, result.shameState)
  buffer.stage(REDIS.HELD_BACK_BUFFER, result.heldBackBuffer)
}

export function stageSecondaryWrites(buffer: WriteBuffer, result: SecondaryResult): void {
  const emotions = getRegisteredEmotions()
  emotions.forEach((entry) => {
    const state = result.secondaryEmotionStates.get(entry.name)
    if (state) {
      buffer.stage(entry.redisKey, state)
    }
  })

  if (result.hasActiveSecondary) {
    buffer.stage(REDIS.EMOTION_CURRENT, result.emotion)
  }
}

export function stageFinalWrites(buffer: WriteBuffer, final: FinalFanResult): void {
  buffer.stage(REDIS.DECEPTION_CURRENT, final.deceptionState)
  buffer.stage(REDIS.COMMUNICATION_REGISTER, final.register)
  buffer.stage(REDIS.ATTENTION_STATE, final.attentionState)
  buffer.stage(REDIS.CREATIVE_URGE, final.creativeUrge)
  buffer.stage(REDIS.COHERENCE_STATE, final.coherenceState)
  buffer.stage(REDIS.METACOGNITION_STATE, final.metacognitiveState)
}

export function stageAllFeelWrites(
  buffer: WriteBuffer,
  chain: EmotionChainResult,
  parallel: ParallelFanResult,
  vulnerabilityResult: VulnerabilityChainResult,
  secondary: SecondaryResult,
  final: FinalFanResult
): void {
  stageEmotionChainWrites(buffer, chain)
  stageParallelWrites(buffer, parallel)
  stageVulnerabilityWrites(buffer, vulnerabilityResult)
  stageSecondaryWrites(buffer, secondary)
  stageFinalWrites(buffer, final)
}
