import { log } from "@/lib/logger.ts"
import { getKnowledge } from "@/memory/semantic.ts"
import { IDENTITY_PROMPT } from "@/prompts/identity.ts"

const MAX_SELF_INSIGHTS = 10

/**
 * Build the [IDENTITY] prompt block combining ANIMA's philosophical foundation
 * with accumulated self-insights from reflection.
 */
export async function buildIdentityPrompt(): Promise<string> {
  const sections: string[] = ["[IDENTITY]", IDENTITY_PROMPT]

  const insightsResult = await getKnowledge("insight", undefined, "self")

  if (insightsResult.isOk() && insightsResult.value.length > 0) {
    const insights = insightsResult.value
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
      .slice(0, MAX_SELF_INSIGHTS)
      .map((i) => (typeof i.value === "string" ? i.value : String(i.value)))

    sections.push(
      `\nSelf-understanding (things I have learned about myself):\n${insights.map((i) => `- ${i}`).join("\n")}`
    )
  } else if (insightsResult.isErr()) {
    log.warn("Failed to load self-insights for identity prompt", { error: insightsResult.error.message })
  }

  return sections.join("\n")
}
