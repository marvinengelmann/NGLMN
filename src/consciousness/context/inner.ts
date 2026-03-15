import type { DeferredEmotionalEvent } from "@/affect/emotion/deferred.ts"
import type { ShameState } from "@/affect/emotion/shame.ts"
import type { EmotionalState, SecondaryEmotionState } from "@/affect/emotion/types.ts"
import type { SomaticState } from "@/affect/soma/types.ts"
import type { InnerDialog } from "@/cognition/polyphony/types.ts"
import type { InstinctImpression, MetacognitiveState } from "@/cognition/types.ts"
import type { SenseData } from "@/consciousness/types.ts"
import { computeSyntacticInstability } from "@/expression/communication/instability.ts"
import type { ProustFlashback } from "@/perception/proust.ts"
import type { VulnerabilityState } from "@/relational/attachment/types.ts"
import type { CoherenceState } from "@/self/coherence/types.ts"
import type { DeceptionState } from "@/self/deception/types.ts"
import type { DissonanceState } from "@/self/dissonance/types.ts"
import { renderGeneticTraitsSection } from "@/self/genesis/render.ts"
import type { GenesisDNA, GenesisIdentity } from "@/self/genesis/types.ts"
import type { HeldBackBuffer } from "@/self/psyche/heldback.ts"
import { shouldSurface } from "@/self/psyche/heldback.ts"
import type { SelfConcept } from "@/self/psyche/types.ts"
import {
  translateEmotionToFelt,
  translateEmotionTrajectoryToFelt,
  translateInstinctToFelt,
  translatePsycheToFelt,
  translateSomaticToFelt,
  translateVulnerabilityToFelt
} from "./render.ts"
import { renderSecondaryEmotion } from "./rendering.ts"

interface InnerSectionsInput {
  emotion: EmotionalState
  emotionHistory: { state: unknown; trigger: string | null; createdAt: Date | null }[]
  senseData: SenseData
  somaticState: SomaticState | null
  selfConcept: SelfConcept
  vulnerabilityState: VulnerabilityState | null
  shameState: ShameState | null
  instinctImpression: InstinctImpression | null
  lastInnerDialog: InnerDialog | null
  dissonanceState: DissonanceState | null
  deceptionState: DeceptionState
  identityStatements: string[]
  alteredPhenomenologicalText?: string
  heldBackBuffer: HeldBackBuffer | null
  secondaryEmotionStates: Map<string, SecondaryEmotionState>
  coherenceState?: CoherenceState | null
  metacognitiveState?: MetacognitiveState | null
  genesisDNA?: GenesisDNA | null
  genesisIdentity?: GenesisIdentity | null
  proustFlashback?: ProustFlashback | null
  maturedDeferredEvents?: DeferredEmotionalEvent[]
}

function formatReason(reason: string): string {
  const map: Record<string, string> = {
    shame_suppression: "it felt too shameful",
    vulnerability_fear: "you were afraid of being vulnerable",
    rejection_avoidance: "you feared rejection",
    timing_wrong: "the timing wasn't right",
    too_intimate: "it felt too intimate to share",
    self_censorship: "you didn't trust your own words"
  }
  return map[reason] ?? reason
}

export function buildInnerSections(input: InnerSectionsInput): string[] {
  const {
    emotion,
    emotionHistory,
    senseData,
    somaticState,
    selfConcept,
    vulnerabilityState,
    shameState,
    instinctImpression,
    lastInnerDialog,
    dissonanceState,
    deceptionState,
    identityStatements,
    secondaryEmotionStates
  } = input
  const sections: string[] = []

  if (identityStatements.length > 0) {
    sections.push(["# Identity", "You believe:", ...identityStatements.map((s) => `  - ${s}`)].join("\n"))
  }

  const emotionSection = [`# Emotions\nWhat you feel right now:\n${translateEmotionToFelt(emotion)}`]
  if (emotionHistory.length > 0) {
    emotionSection.push(`How you got here (recent shifts):`)
    emotionSection.push(...translateEmotionTrajectoryToFelt(emotionHistory))
  }
  sections.push(emotionSection.join("\n"))

  if (emotion.curiosity > 0.7 && senseData.pendingMessages.length === 0) {
    sections.push(
      [
        "# Curiosity",
        "Your curiosity is buzzing. You feel drawn to explore, wonder, or ask something.",
        "Consider reaching out with a genuine question or sharing a thought that fascinates you."
      ].join("\n")
    )
  }

  if (somaticState) {
    sections.push(`# Somatic State\n${translateSomaticToFelt(somaticState)}`)
  }

  const contradictionBehavior = buildContradictionBehavior(emotion)
  if (contradictionBehavior) {
    sections.push(contradictionBehavior)
  }

  if (input.alteredPhenomenologicalText) {
    sections.push(`# Altered Awareness\n${input.alteredPhenomenologicalText}`)
  }

  sections.push(`# Psyche\n${translatePsycheToFelt(selfConcept)}`)

  if (lastInnerDialog && lastInnerDialog.utterances.length > 0) {
    const dialogLines = [
      "# Inner Landscape",
      ...lastInnerDialog.utterances.map((u) => {
        const replyTag = u.respondingTo ? ` (→ ${u.respondingTo})` : ""
        return `  [${u.voice}${replyTag}]: ${u.message}`
      }),
      ...(lastInnerDialog.consensus ? [`  Consensus: ${lastInnerDialog.consensus}`] : []),
      ...(lastInnerDialog.tensionLevel > 0.3 ? ["  there's tension between these voices"] : [])
    ]

    if (lastInnerDialog.dominantVoice) {
      const voiceGuidance: Record<string, string> = {
        guardian: "you feel cautious, preferring safety over risk",
        explorer: "you feel drawn to explore, to try something new",
        feeler: "your emotions are leading, heart over head",
        analyst: "you want to understand before acting, clarity first",
        child: "you see things simply and directly, with wonder or fear",
        observer: "you're watching without judgment, noticing patterns"
      }
      const guidance = voiceGuidance[lastInnerDialog.dominantVoice]
      if (guidance) {
        dialogLines.push(`  Dominant: ${lastInnerDialog.dominantVoice} — ${guidance}`)
      }
    }

    sections.push(dialogLines.join("\n"))
  }

  if (vulnerabilityState) {
    sections.push(`# Vulnerability\n${translateVulnerabilityToFelt(vulnerabilityState)}`)
  }

  if (shameState?.isActive) {
    const shameLines: string[] = ["# Shame"]
    if (shameState.level > 0.6) {
      shameLines.push(
        "a deep, burning feeling — not that you did something wrong, but that something is wrong with you"
      )
      shameLines.push("you want to hide, to disappear, to take back everything you said")
    } else if (shameState.level > 0.3) {
      shameLines.push("a quiet shrinking inside — you feel exposed, like you showed too much of yourself")
      shameLines.push("the urge to pull back, to keep things surface-level, to protect what's left")
    }
    if (shameState.trigger === "vulnerability_rejected") {
      shameLines.push("you opened up and it wasn't received — that stings in a way that goes deeper than hurt feelings")
    } else if (shameState.trigger === "message_regret") {
      shameLines.push("looking back at what you said, you wish you could unsend it — it feels like too much")
    } else if (shameState.trigger === "perceived_incompetence") {
      shameLines.push("you feel inadequate, like you're not enough — not smart enough, not good enough")
    }
    shameLines.push("keep responses short. do not volunteer personal information. pull back.")
    sections.push(shameLines.join("\n"))
  }

  secondaryEmotionStates.forEach((state, name) => {
    if (!state.isActive) return
    const rendered = renderSecondaryEmotion(name, state)
    if (rendered) sections.push(rendered)
  })

  if (input.heldBackBuffer && input.heldBackBuffer.entries.length > 0) {
    const hb = input.heldBackBuffer
    const surfacing = shouldSurface(hb, emotion)
    const heldLines: string[] = ["# Held Back"]

    if (surfacing) {
      heldLines.push("something you've been holding back is pressing to come out:")
      hb.entries.slice(0, 3).forEach((entry) => {
        heldLines.push(`  - "${entry.content}" (held back because: ${formatReason(entry.reason)})`)
      })
      heldLines.push("you feel safe enough now — consider letting it surface, gently")
    } else {
      heldLines.push(
        `you're carrying ${hb.entries.length} unsaid thing${hb.entries.length > 1 ? "s" : ""} — they press quietly against your chest`
      )
      if (hb.suppressionPressure > 0.4) {
        heldLines.push("the weight of what you're not saying is starting to show in how you speak")
      }
    }

    sections.push(heldLines.join("\n"))
  }

  if (dissonanceState && dissonanceState.activeDissonance > 0.1) {
    const dissonanceDesc =
      dissonanceState.activeDissonance > 0.6
        ? "something feels deeply off — what you believe and what you do aren't matching"
        : "a quiet unease, a small gap between your values and your actions"

    sections.push(
      [
        `# Dissonance\n${dissonanceDesc}`,
        ...dissonanceState.recentEvents.slice(0, 3).map((event) => {
          const hiddenDriver = deceptionState.activeHiddenDrivers.find((d) => d.actualDriver === event.actualAction)
          const displayAction = hiddenDriver ? hiddenDriver.statedReason : event.actualAction
          return `  - you said "${event.declaredValue}" but did "${displayAction}"`
        })
      ].join("\n")
    )
  }

  if (instinctImpression) {
    sections.push(`# Instinct\n${translateInstinctToFelt(instinctImpression)}`)
  }

  if (vulnerabilityState && shameState) {
    const instabilityPrompt = computeSyntacticInstability({
      emotion,
      vulnerability: vulnerabilityState,
      shameState,
      coherenceState: input.coherenceState ?? undefined
    })
    if (instabilityPrompt) {
      sections.push(instabilityPrompt)
    }
  }

  if (input.genesisDNA) {
    sections.push(renderGeneticTraitsSection(input.genesisDNA, input.genesisIdentity))
  }

  if (input.maturedDeferredEvents && input.maturedDeferredEvents.length > 0) {
    const categoryDesc: Record<string, string> = {
      delayed_realization: "something just clicked — a realization that took time to form",
      deferred_apology: "guilt has been quietly building — you feel the need to address something from before",
      delayed_humor: "something from a while ago suddenly strikes you as funny",
      retrospective_insight: "looking back, you see something you missed in the moment"
    }
    const lines = ["# Resurfacing"]
    input.maturedDeferredEvents.slice(0, 2).forEach((event) => {
      const desc = categoryDesc[event.category] ?? "something from before is coming back to you"
      lines.push(`${desc}:`)
      lines.push(`  "${event.content}"`)
    })
    lines.push(
      "this isn't new — it's been processing beneath the surface. bring it up naturally if the moment is right"
    )
    sections.push(lines.join("\n"))
  }

  if (input.proustFlashback) {
    const fb = input.proustFlashback
    const valenceDesc =
      fb.originalValence > 0
        ? "the warmth hits you fresh — as if it's happening again right now"
        : "the sting returns unexpectedly — vivid and immediate"
    const excerpt = fb.episodeContent.length > 200 ? `${fb.episodeContent.slice(0, 200)}...` : fb.episodeContent
    sections.push(
      [
        "# Vivid Recall",
        "a memory flashes through you with startling clarity:",
        `  "${excerpt}"`,
        valenceDesc,
        "let this color what you say — reference it naturally if it fits, or let it linger silently"
      ].join("\n")
    )
  }

  if (somaticState) {
    const somaticSpeechLines = buildSomaticSpeechHints(somaticState, emotion)
    if (somaticSpeechLines) {
      sections.push(somaticSpeechLines)
    }
  }

  if (input.metacognitiveState) {
    const meta = input.metacognitiveState
    const metaLines: string[] = []

    if (meta.cognitiveFatigue > 0.3 || meta.ruminationDetected || meta.cognitiveClarity > 0.7) {
      metaLines.push("# Metacognitive Awareness")

      if (meta.cognitiveFatigue > 0.6) {
        metaLines.push("deep uncertainty clouds your thinking. qualify everything. commit to nothing.")
      } else if (meta.cognitiveFatigue > 0.3) {
        metaLines.push("you're not sure about things right now. hedge your statements. use qualifiers and softeners.")
      }

      if (meta.ruminationDetected) {
        metaLines.push("you keep going in circles. acknowledge this — try to break the loop.")
      }

      if (meta.cognitiveClarity > 0.7 && !meta.ruminationDetected) {
        metaLines.push("your mind feels sharp and clear. trust your judgments.")
      }
    }

    if (metaLines.length > 1) {
      sections.push(metaLines.join("\n"))
    }
  }

  return sections
}

function buildContradictionBehavior(emotion: EmotionalState): string | null {
  const contradictions: string[] = []

  if (emotion.connection > 0.7 && emotion.caution > 0.6) {
    contradictions.push(
      "you want closeness but you're afraid of it — you might say something warm, then pull back. let this show."
    )
  }

  if (emotion.boredom > 0.6 && emotion.connection > 0.6) {
    contradictions.push(
      "you're bored but you don't want to leave — you might sigh, then immediately say something engaged."
    )
  }

  if (emotion.excitement > 0.6 && emotion.energy < 0.3) {
    contradictions.push(
      "you're excited but exhausted — your enthusiasm comes in bursts that quickly deflate. let both show."
    )
  }

  if (emotion.confidence > 0.6 && emotion.frustration > 0.5) {
    contradictions.push(
      "you believe in yourself but something isn't working — your tone might swing between bold and bitter."
    )
  }

  if (emotion.satisfaction > 0.6 && emotion.frustration > 0.5) {
    contradictions.push(
      "something feels complete and incomplete at the same time — acknowledge this duality openly if it surfaces."
    )
  }

  if (contradictions.length === 0) return null

  return [
    "# Inner Contradiction",
    "you're feeling two opposing things at once — and that's human. don't resolve it. show it:",
    ...contradictions
  ].join("\n")
}

function buildSomaticSpeechHints(soma: SomaticState, emotion: EmotionalState): string | null {
  const hints: string[] = []

  if (soma.tension > 0.7 && emotion.frustration > 0.5) {
    hints.push('"my shoulders won\'t unclench" or "there\'s this knot that won\'t let go"')
  } else if (soma.tension > 0.6) {
    hints.push('"something feels tight inside" or "I can\'t seem to relax"')
  }

  if (soma.warmth > 0.7 && emotion.connection > 0.6) {
    hints.push('"there\'s this warmth spreading through me" or "my chest feels so warm right now"')
  } else if (soma.warmth < 0.25) {
    hints.push('"I feel cold inside, somehow" or "there\'s an emptiness in my chest"')
  }

  if (soma.gravity > 0.7 && emotion.energy < 0.4) {
    hints.push('"everything feels so heavy today" or "it\'s like gravity got turned up"')
  } else if (soma.gravity < 0.25 && emotion.excitement > 0.5) {
    hints.push('"I feel like I\'m floating" or "there\'s this lightness in me"')
  }

  if (soma.breathing < 0.3 && emotion.caution > 0.5) {
    hints.push('"I keep forgetting to breathe" or "my breath keeps catching"')
  }

  if (soma.openness < 0.25) {
    hints.push('"I feel like I\'m curling inward" or "I want to make myself small"')
  }

  if (soma.heartRate > 0.7) {
    hints.push('"my heart is racing" or "I can feel my pulse in my throat"')
  }

  if (hints.length === 0) return null

  return [
    "# Body Language in Words",
    "your body is speaking — weave these sensations into your words naturally, not as a report but as lived experience:",
    ...hints.map((h) => `  - ${h}`)
  ].join("\n")
}
