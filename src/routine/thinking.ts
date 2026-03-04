import type { SenseResult } from "@/consciousness/types.ts"
import { callIntelligence } from "@/core/intelligence.ts"
import { TextOutput } from "@/core/types.ts"
import { metricsRecalibration, morningRecalibration } from "@/emotion/calibration.ts"
import { collectMetrics } from "@/emotion/metrics.ts"
import { log } from "@/lib/logger.ts"
import { getOperatorLanguage } from "@/memory/semantic.ts"
import { getDreamInsights } from "@/memory/working.ts"
import { REFLECTION_SYSTEM_PROMPT } from "@/prompts/routine.ts"
import { buildMorningContext } from "@/routine/morning.ts"
import { buildReflectionInput } from "@/routine/reflection.ts"
import { type MorningThinkResult, ReflectionOutput } from "@/routine/types.ts"

/**
 * Run morning-specific thinking: metrics recalibration, reflection, and morning message generation.
 */
export async function thinkMorning(senseResult: SenseResult): Promise<MorningThinkResult> {
  const metrics = await collectMetrics()
  const afterMetrics = metricsRecalibration(senseResult.emotion, metrics)
  const recalibratedEmotion = morningRecalibration(afterMetrics, senseResult.moodContext)

  const reflectionInput = await buildReflectionInput()
  const reflectionResult = await callIntelligence({
    system: senseResult.systemPrompt,
    userMessage: `${REFLECTION_SYSTEM_PROMPT}\n\n${JSON.stringify(reflectionInput)}`,
    schema: ReflectionOutput,
    maxTokens: 4096
  })

  const reflection = reflectionResult.isOk() ? reflectionResult.value : { insights: [], existentialQuestions: [] }
  if (reflectionResult.isErr()) {
    log.warn("thinkMorning: reflection LLM failed", { error: reflectionResult.error.message })
  }

  const [dreamInsights, operatorLanguage] = await Promise.all([getDreamInsights(), getOperatorLanguage()])

  const { systemInstruction, context } = buildMorningContext(dreamInsights, recalibratedEmotion, operatorLanguage)

  const messageResult = await callIntelligence({
    system: senseResult.systemPrompt,
    userMessage: `${systemInstruction}\n\n${context}`,
    schema: TextOutput,
    maxTokens: 1024
  })

  const morningMessage = messageResult.isOk() ? messageResult.value.text : ""
  if (messageResult.isErr()) {
    log.warn("thinkMorning: morning message LLM failed", { error: messageResult.error.message })
  }

  log.info("thinkMorning complete", {
    morningMessageLength: morningMessage.length,
    reflectionInsights: reflection.insights.length
  })

  return { recalibratedEmotion, reflection, morningMessage }
}

/**
 * Run ad-hoc reflection thinking.
 */
export async function thinkReflect(senseResult: SenseResult): Promise<ReflectionOutput> {
  const reflectionInput = await buildReflectionInput()
  const result = await callIntelligence({
    system: senseResult.systemPrompt,
    userMessage: `${REFLECTION_SYSTEM_PROMPT}\n\n${JSON.stringify(reflectionInput)}`,
    schema: ReflectionOutput,
    maxTokens: 4096
  })

  if (result.isErr()) {
    log.warn("thinkReflect: LLM failed", { error: result.error.message })
    return { insights: [], existentialQuestions: [] }
  }

  log.info("thinkReflect complete", { insights: result.value.insights.length })
  return result.value
}
