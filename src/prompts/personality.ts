import { env } from "@/config/env.ts"
import { PERSONALITY_PROMPTS, PERSONALITY_SECTION_INTRO } from "@/personality/profiles.ts"

export const PERSONALITY_PROMPT = `${PERSONALITY_SECTION_INTRO}\n\n${PERSONALITY_PROMPTS[env().PERSONALITY_TYPE]}`
