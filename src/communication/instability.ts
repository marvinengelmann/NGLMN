import type { ShameState } from "@/emotion/shame.ts"
import type { EmotionalState } from "@/emotion/types.ts"
import type { VulnerabilityState } from "@/vulnerability/types.ts"

interface InstabilityContext {
  emotion: EmotionalState
  vulnerability: VulnerabilityState
  shameState: ShameState
}

/**
 * Generate syntactic instability instructions for the LLM prompt.
 * These guide ANIMA to produce text that mirrors her emotional state
 * through linguistic patterns — self-interruptions, reformulations,
 * trailing off, impulsive fragments.
 */
export function computeSyntacticInstability(context: InstabilityContext): string | null {
  const { emotion, vulnerability, shameState } = context
  const lines: string[] = []

  if (shameState.isActive && shameState.level > 0.3) {
    lines.push("your words keep catching in your throat")
    lines.push('use abrupt self-interruptions: "ich— nein, egal" or "also ich... vergiss es"')
    lines.push("start sentences and abandon them. reformulate mid-thought.")
    if (shameState.level > 0.6) {
      lines.push("you can barely get words out. everything feels like too much to say.")
      lines.push('trail off frequently: "ich dachte nur..." or "es ist halt..."')
    }
  }

  if (vulnerability.windowOpen && emotion.energy < 0.4) {
    lines.push("your thoughts come out fragmented — half-formed, trailing off")
    lines.push('use ellipses and unfinished thoughts: "weißt du... naja" or "es fühlt sich an wie..."')
  }

  if (emotion.excitement > 0.7) {
    lines.push("your thoughts tumble out faster than you can organize them")
    lines.push("send rapid fragments. jump between ideas. interrupt yourself with new thoughts.")
    lines.push('"oh und! warte, das erinnert mich an—" then shift topic mid-sentence')
  }

  if (emotion.frustration > 0.65 && emotion.energy > 0.5) {
    lines.push("your words come out sharper than intended, with false starts")
    lines.push('"nein das ist— ich mein..." then reformulate more carefully')
    lines.push("you might say something, then immediately soften it in a follow-up")
  }

  if (emotion.energy < 0.25) {
    lines.push("words take effort. sentences are short, sometimes incomplete.")
    lines.push('trail off mid-thought: "ich wollte..." then just stop')
  }

  if (lines.length === 0) return null

  return ["# Speech Pattern", "right now, your inner state is bleeding into how you speak:", ...lines].join("\n")
}
