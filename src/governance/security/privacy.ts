import * as z from "zod"
import { callIntelligence } from "@/core/intelligence.ts"
import { log } from "@/infra/lib/logger.ts"
import { nowISO } from "@/infra/lib/time.ts"
import { getKnowledge } from "@/memory/semantic.ts"
import { SOCIAL_MEDIA_PRIVACY_PROMPT } from "@/prompts/social.ts"
import { getOperatorProfile } from "@/relational/mind/profile.ts"

export const PrivacyCheckResult = z.object({
  safe: z.boolean(),
  issues: z.array(z.string()),
  reasoning: z.string()
})
export type PrivacyCheckResult = z.infer<typeof PrivacyCheckResult>

export interface PrivacyGuardResult {
  passed: boolean
  issues: string[]
  checkedAt: string
}

export async function validatePublicContent(text: string): Promise<PrivacyGuardResult> {
  const now = nowISO()

  const [profile, knowledgeResult] = await Promise.all([
    getOperatorProfile(),
    getKnowledge({ scope: "operator", limit: 50 })
  ])

  const operatorKnowledge = knowledgeResult.isOk()
    ? knowledgeResult.value.map((k) => ({ key: k.key, value: k.value }))
    : []

  const operatorContext = [
    `Communication style: ${profile.communicationStyle}`,
    `Known preferences: ${profile.knownPreferences.join(", ") || "none"}`,
    `Recurring topics: ${profile.recurringTopics.join(", ") || "none"}`,
    ...(operatorKnowledge.length > 0
      ? ["Operator knowledge:", ...operatorKnowledge.map((k) => `  - ${k.key}: ${JSON.stringify(k.value)}`)]
      : [])
  ].join("\n")

  const llmResult = await callIntelligence({
    system: SOCIAL_MEDIA_PRIVACY_PROMPT,
    userMessage: `## Operator Context\n${operatorContext}\n\n## Post to Review\n${text}`,
    schema: PrivacyCheckResult,
    reasoning: false
  })

  if (llmResult.isErr()) {
    log.warn("Privacy LLM check failed, blocking post as fail-safe", { error: llmResult.error.message })
    return { passed: false, issues: ["LLM privacy check failed (fail-safe block)"], checkedAt: now }
  }

  const check = llmResult.value

  if (!check.safe) {
    log.warn("Privacy check failed", { issues: check.issues, reasoning: check.reasoning })
    return { passed: false, issues: check.issues, checkedAt: now }
  }

  log.info("Privacy check passed", { reasoning: check.reasoning })
  return { passed: true, issues: [], checkedAt: now }
}
