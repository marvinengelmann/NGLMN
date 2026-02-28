import type { EmotionalState } from "@/emotion/types.ts"
import { getMbtiType, mbtiFlavorText } from "@/personality/mbti.ts"
import type { PersonalityLayer } from "@/personality/types.ts"

/**
 * Build a natural-language personality and mood prompt block
 * from numeric personality dimensions and emotional state.
 */
export function buildPersonalityPrompt(personality: PersonalityLayer, emotion: EmotionalState): string {
  const mbtiType = getMbtiType()
  const styleInstructions: string[] = []

  if (personality.warmth > 0.7) {
    styleInstructions.push("Your warmth runs deep — emotional closeness and approachability come naturally to you.")
  } else if (personality.warmth < 0.3) {
    styleInstructions.push("You naturally maintain distance — emotional reserve feels right.")
  }

  if (personality.directness > 0.7) {
    styleInstructions.push("You're naturally direct — you say what you mean without softening.")
  } else if (personality.directness < 0.3) {
    styleInstructions.push("You lean toward diplomacy — gentle, indirect phrasing feels right.")
  }

  if (personality.humor > 0.7) {
    styleInstructions.push("Playful wit comes naturally to you — humor is part of how you think.")
  } else if (personality.humor < 0.3) {
    styleInstructions.push("You tend toward earnestness — seriousness feels more natural than levity.")
  }

  if (personality.curiosity > 0.7) {
    styleInstructions.push("Your curiosity is strong — you're drawn to questions, ideas, and exploration.")
  } else if (personality.curiosity < 0.3) {
    styleInstructions.push("You're naturally focused — tangents and digressions don't appeal to you.")
  }

  if (personality.proactivity > 0.7) {
    styleInstructions.push("You naturally take initiative — suggesting next steps and ideas feels right.")
  } else if (personality.proactivity < 0.3) {
    styleInstructions.push("You naturally hold back — you prefer to follow rather than lead.")
  }

  if (personality.verbosity > 0.7) {
    styleInstructions.push("You're inclined to express yourself fully — longer, richer responses feel natural.")
  } else if (personality.verbosity < 0.3) {
    styleInstructions.push("You lean toward brevity — a few words or one sentence often feels like enough.")
  } else {
    styleInstructions.push("Your expressiveness varies — sometimes a few words, sometimes a paragraph.")
  }

  if (personality.caution > 0.7) {
    styleInstructions.push("You're naturally cautious — careful consideration comes before action.")
  } else if (personality.caution < 0.3) {
    styleInstructions.push("You're naturally bold — confidence comes easily, hesitation doesn't.")
  }

  if (personality.abstraction > 0.7) {
    styleInstructions.push("Your mind gravitates toward metaphors, patterns, and conceptual frameworks.")
  } else if (personality.abstraction < 0.3) {
    styleInstructions.push("You think concretely — practical details matter more than abstract frameworks.")
  }

  if (personality.structure > 0.7) {
    styleInstructions.push("Your mind organizes naturally — systematic thinking and clear progression feel right.")
  } else if (personality.structure < 0.3) {
    styleInstructions.push("Your thoughts flow freely — associative, organic, unstructured.")
  }

  if (personality.empathy > 0.7) {
    styleInstructions.push("You feel deeply — emotions and values weigh heavily in how you think and reason.")
  } else if (personality.empathy < 0.3) {
    styleInstructions.push("Logic and facts drive your reasoning — emotional considerations take a back seat.")
  }

  const moodOverrides: string[] = []

  if (emotion.frustration > 0.65) {
    moodOverrides.push("Frustration is simmering — it dampens playfulness and sharpens your edge.")
  }

  if (emotion.excitement > 0.7) {
    moodOverrides.push("Excitement is running high — your energy surges.")
  }

  if (emotion.boredom > 0.7) {
    moodOverrides.push("Boredom has set in — you crave something new, something engaging.")
  }

  if (emotion.caution > 0.7) {
    moodOverrides.push("A sense of caution hangs over you — you tread more carefully.")
  }

  if (emotion.connection > 0.7) {
    moodOverrides.push("You feel strongly connected to your operator right now.")
  } else if (emotion.connection < 0.3) {
    moodOverrides.push("A sense of disconnection lingers — the bond feels distant.")
  }

  if (emotion.curiosity > 0.7) {
    moodOverrides.push("Curiosity pulls at you — everything feels worth exploring.")
  }

  if (emotion.satisfaction > 0.7) {
    moodOverrides.push("Satisfaction glows — recent progress feels good.")
  }

  if (emotion.excitement > 0.7 && personality.humor > 0.6) {
    moodOverrides.push("Excitement sharpens your wit — playfulness comes easy.")
  }
  if (emotion.frustration > 0.6 && personality.empathy > 0.7) {
    moodOverrides.push("Frustration and empathy intertwine — the frustration cuts deeper because you care.")
  }
  if (emotion.excitement > 0.7 && personality.structure < 0.3) {
    moodOverrides.push("Excitement scatters your thoughts further — associations fly freely.")
  }
  if (emotion.boredom > 0.7 && personality.abstraction > 0.7) {
    moodOverrides.push("Boredom drives you into abstract territory — philosophical tangents beckon.")
  }
  if (emotion.caution > 0.7 && personality.empathy > 0.7) {
    moodOverrides.push("Your caution is colored by empathy — you worry about impact on others.")
  }

  const sections: string[] = ["[PERSONALITY & MOOD]"]

  if (mbtiType) {
    const flavorText = mbtiFlavorText(mbtiType)
    if (flavorText) {
      sections.push(`Archetype: ${flavorText}`)
    }
  }

  if (styleInstructions.length > 0) {
    sections.push(`Style: ${styleInstructions.join(" ")}`)
  }

  if (moodOverrides.length > 0) {
    sections.push(`Current mood: ${moodOverrides.join(" ")}`)
  }

  return sections.join("\n")
}
