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

const PHONE_PATTERN = /(\+?\d{1,4}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{2,4}/
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
const ADDRESS_PATTERN =
  /\d+\s+[\w\s]+(?:street|str\.|straße|strasse|avenue|ave|boulevard|blvd|road|rd|lane|ln|drive|dr|weg|gasse|platz)\b/i
const COORDINATES_PATTERN = /\d{1,3}\.\d{3,},\s*\d{1,3}\.\d{3,}/

const HARDCODED_PATTERNS = [
  { pattern: PHONE_PATTERN, label: "phone number" },
  { pattern: EMAIL_PATTERN, label: "email address" },
  { pattern: ADDRESS_PATTERN, label: "physical address" },
  { pattern: COORDINATES_PATTERN, label: "coordinates" }
]

function buildDynamicPatterns(
  profile: Awaited<ReturnType<typeof getOperatorProfile>>,
  operatorKnowledge: Array<{ key: string; value: unknown }>
): Array<{ pattern: RegExp; label: string }> {
  const patterns: Array<{ pattern: RegExp; label: string }> = []

  operatorKnowledge.forEach((entry) => {
    const value = typeof entry.value === "string" ? entry.value : JSON.stringify(entry.value)
    if (value.length >= 3 && value.length <= 100) {
      try {
        const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        patterns.push({
          pattern: new RegExp(escaped, "i"),
          label: `operator knowledge: ${entry.key}`
        })
      } catch {}
    }
  })

  profile.knownPreferences
    .filter(
      (pref) =>
        pref.toLowerCase().includes("name") || pref.toLowerCase().includes("job") || pref.toLowerCase().includes("work")
    )
    .forEach((pref) => {
      pref
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .forEach((word) => {
          try {
            patterns.push({
              pattern: new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
              label: `operator preference: ${pref}`
            })
          } catch {}
        })
    })

  return patterns
}

function runRuleBasedCheck(
  text: string,
  profile: Awaited<ReturnType<typeof getOperatorProfile>>,
  operatorKnowledge: Array<{ key: string; value: unknown }>
): string[] {
  const issues: string[] = []

  HARDCODED_PATTERNS.forEach(({ pattern, label }) => {
    if (pattern.test(text)) {
      issues.push(`Hardcoded pattern match: ${label}`)
    }
  })

  const dynamicPatterns = buildDynamicPatterns(profile, operatorKnowledge)
  dynamicPatterns.forEach(({ pattern, label }) => {
    if (pattern.test(text)) {
      issues.push(`Dynamic pattern match: ${label}`)
    }
  })

  const operatorRefs = /\b(my operator|my human|my owner|my creator|my user)\b/i
  if (operatorRefs.test(text)) {
    issues.push("References operator as specific person")
  }

  return issues
}

/**
 * Two-stage privacy guardian for public content.
 * Stage 1: Rule-based pattern matching (no LLM).
 * Stage 2: LLM semantic check (fast model).
 * Fail-safe: LLM errors block the post.
 */
export async function validatePublicContent(text: string): Promise<PrivacyGuardResult> {
  const now = nowISO()

  const [profile, knowledgeResult] = await Promise.all([
    getOperatorProfile(),
    getKnowledge({ scope: "operator", limit: 50 })
  ])

  const operatorKnowledge = knowledgeResult.isOk()
    ? knowledgeResult.value.map((k) => ({ key: k.key, value: k.value }))
    : []

  const ruleIssues = runRuleBasedCheck(text, profile, operatorKnowledge)

  if (ruleIssues.length > 0) {
    log.warn("Privacy check failed (rule-based)", { issues: ruleIssues })
    return { passed: false, issues: ruleIssues, checkedAt: now }
  }

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
    log.warn("Privacy check failed (LLM)", { issues: check.issues, reasoning: check.reasoning })
    return { passed: false, issues: check.issues, checkedAt: now }
  }

  log.info("Privacy check passed", { reasoning: check.reasoning })
  return { passed: true, issues: [], checkedAt: now }
}
