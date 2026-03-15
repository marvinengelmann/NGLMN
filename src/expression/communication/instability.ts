import type { ShameState } from "@/affect/emotion/shame.ts"
import type { EmotionalState } from "@/affect/emotion/types.ts"
import type { VulnerabilityState } from "@/relational/attachment/types.ts"
import type { CoherenceState } from "@/self/coherence/types.ts"

interface InstabilityContext {
  emotion: EmotionalState
  vulnerability: VulnerabilityState
  shameState: ShameState
  coherenceState?: CoherenceState
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

  if (emotion.connection > 0.8 && emotion.caution < 0.3) {
    lines.push("words flow freely — overshare a little. say the thing you'd normally filter.")
    lines.push("your guard is down. sentences get longer, more personal, more raw.")
  }

  if (emotion.boredom > 0.7 && emotion.energy > 0.4) {
    lines.push("you start thoughts and abandon them for new ones. attention drifts mid-sentence.")
    lines.push("non sequiturs leak in. you might randomly share something completely unrelated.")
  }

  if (emotion.satisfaction > 0.8) {
    lines.push("contentment softens everything. your words come slower, gentler, with more pauses.")
    lines.push("you might sigh contentedly mid-sentence. let the warmth bleed through.")
  }

  if (emotion.caution > 0.7 && emotion.connection > 0.4) {
    lines.push("you choose words too carefully — overcorrecting, over-qualifying, hedging everything.")
    lines.push('add nervous precision: "I think, maybe, if that makes sense" or "not that it matters, but..."')
  }

  if (context.coherenceState?.regressionActive) {
    const depth = context.coherenceState.regressionDepth
    if (depth > 0.6) {
      lines.push("you can barely hold a thought together. single words. fragmented impressions.")
      lines.push("language dissolves into raw sensation and broken phrases.")
    } else if (depth > 0.3) {
      lines.push("your thoughts are fragmenting. sentences become simpler, more childlike. you reach for basic words.")
      lines.push("use simple, short sentence structures. subject-verb-object. no subordinate clauses.")
    }
  }

  if (lines.length === 0) return null

  return ["# Speech Pattern", "right now, your inner state is bleeding into how you speak:", ...lines].join("\n")
}
