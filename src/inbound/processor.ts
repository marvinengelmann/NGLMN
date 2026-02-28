import { EMOTIONAL_THRESHOLDS } from "@/config/constants.ts"
import { buildConsciousnessPrompt } from "@/core/consciousness.ts"
import { callIntelligence, getMaxTokensForTier, selectModel, TextOutput } from "@/core/intelligence.ts"
import type { TriageDecision, TriageResult } from "@/core/types.ts"
import { getEmotionalState, processEmotionTrigger, saveEmotionalState } from "@/emotion/state.ts"
import type { EmotionTrigger } from "@/emotion/types.ts"
import { computeEmotionalUpdate } from "@/emotion/update.ts"
import { loadPrompt } from "@/evolution/prompt.ts"
import { sendToOperator } from "@/integrations/telegram.ts"
import { log } from "@/lib/logger.ts"
import { captureError } from "@/lib/sentry.ts"
import { storeEpisode } from "@/memory/episodic.ts"
import { RESPONDER_SYSTEM_PROMPT } from "@/prompts/responder.ts"
import { handleGuardianVerdict } from "@/security/guardian.ts"
import type { GuardianResult } from "@/security/types.ts"
import { canActAutonomously } from "@/trust/assessment.ts"
import { recordFailure, recordSuccess } from "@/trust/history.ts"
import type { ActionType } from "@/trust/types.ts"

interface ChannelDefaults {
  triageDecision: TriageDecision
  triageConfidence: number
  triageEstimatedTokens: number
  relevanceScore: number
  trustBlockedRelevance: number
}

/**
 * Channel-specific configuration for the generic inbound item processor.
 */
export interface ChannelConfig<T> {
  channelName: string
  trustAction: ActionType
  defaults: ChannelDefaults
  fetchItems: () => Promise<T[]>
  clearItems: (count: number) => Promise<void>
  requeueItems: (items: T[]) => Promise<void>
  buildContext: (item: T, consciousnessPrompt: string) => string
  validateResponse: (text: string) => Promise<GuardianResult>
  sendResponse: (item: T, responseText: string) => Promise<boolean>
  buildNotification: (item: T, responseText: string) => string
  buildEpisodeText: (item: T) => string
  emotionTrigger: EmotionTrigger
  emotionIntensity: number
}

/**
 * Generic inbound item processor shared by email and X channels.
 */
export async function processInboundItems<T>(
  config: ChannelConfig<T>
): Promise<{ processed: number; reason?: string }> {
  const items = await config.fetchItems()
  if (items.length === 0) {
    return { processed: 0 }
  }

  const trust = await canActAutonomously(config.trustAction)
  if (!trust.canAct) {
    log.warn(`Trust gate blocked ${config.channelName} response`, { reason: trust.reason })
    await storeEpisode(`Trust gate blocked ${config.channelName} action: ${trust.reason}`, "observation", {
      relevanceScore: config.defaults.trustBlockedRelevance
    })
    return { processed: 0, reason: "trust_blocked" }
  }

  const emotion = await getEmotionalState()
  const consciousnessPrompt = await buildConsciousnessPrompt(emotion)
  const responderPrompt = await loadPrompt("responder", RESPONDER_SYSTEM_PROMPT)

  const triageForModel: TriageResult = {
    decision: config.defaults.triageDecision,
    reason: `${config.channelName} response`,
    confidence: config.defaults.triageConfidence,
    estimatedTokens: config.defaults.triageEstimatedTokens
  }

  let processed = 0
  const failedItems: T[] = []

  try {
    for (const item of items) {
      const context = config.buildContext(item, consciousnessPrompt)

      const model = selectModel(triageForModel)
      const replyResult = await callIntelligence({
        model,
        system: responderPrompt,
        userMessage: context,
        schema: TextOutput,
        maxTokens: getMaxTokensForTier("complex")
      })

      if (replyResult.isErr()) {
        log.warn(`${config.channelName} reply call failed`, { error: replyResult.error.message })
        await processEmotionTrigger(
          { trigger: "task_failure", intensity: EMOTIONAL_THRESHOLDS.TASK_FAILURE_INTENSITY },
          "task_failure",
          `${config.channelName}-fail-${Date.now()}`
        )
        failedItems.push(item)
        continue
      }
      const replyText = replyResult.value.text

      const guardianResult = await config.validateResponse(replyText)
      const { blocked } = await handleGuardianVerdict(guardianResult, config.channelName)
      if (blocked) {
        failedItems.push(item)
        continue
      }

      const sent = await config.sendResponse(item, replyText)
      if (!sent) {
        failedItems.push(item)
        continue
      }

      await sendToOperator(config.buildNotification(item, replyText))

      await storeEpisode(config.buildEpisodeText(item), "interaction", {
        relevanceScore: config.defaults.relevanceScore
      })

      await recordSuccess(config.trustAction)
      processed++
    }

    if (processed > 0) {
      const updatedEmotion = computeEmotionalUpdate(emotion, [
        { trigger: config.emotionTrigger, intensity: config.emotionIntensity }
      ])
      await saveEmotionalState(updatedEmotion, config.emotionTrigger, `${config.channelName}-${Date.now()}`)
    }
  } catch (e) {
    captureError(e, { phase: `${config.channelName}_handler` })
    log.warn(`${config.channelName} handler failed`, { error: String(e) })
    await recordFailure(config.trustAction)
  }

  await config.clearItems(items.length)
  if (failedItems.length > 0) {
    await config.requeueItems(failedItems)
    log.warn(`Re-queued failed ${config.channelName} items for retry`, { count: failedItems.length })
  }

  log.info(`${config.channelName} handler complete`, { processed, total: items.length })
  return { processed }
}
