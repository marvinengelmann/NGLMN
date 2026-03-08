import { getGenesisPersonalityType } from "@/genesis/state.ts"
import { PERSONALITY_PROMPTS, PERSONALITY_SECTION_INTRO } from "@/personality/profiles.ts"

/**
 * Build the personality prompt using the genesis-derived personality type.
 */
export async function getPersonalityPrompt(): Promise<string> {
  const personalityType = await getGenesisPersonalityType()
  return `${PERSONALITY_SECTION_INTRO}\n\n${PERSONALITY_PROMPTS[personalityType]}`
}
