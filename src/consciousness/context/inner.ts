import type { InstinctImpression } from "@/cognition/types.ts"
import { computeSyntacticInstability } from "@/communication/instability.ts"
import type { SenseData } from "@/consciousness/types.ts"
import type { DeceptionState } from "@/deception/types.ts"
import type { DissonanceState } from "@/dissonance/types.ts"
import type { ShameState } from "@/emotion/shame.ts"
import type { EmotionalState, SecondaryEmotionState } from "@/emotion/types.ts"
import type { InnerDialog } from "@/polyphony/types.ts"
import type { HeldBackBuffer } from "@/psyche/heldback.ts"
import { shouldSurface } from "@/psyche/heldback.ts"
import type { SelfConcept } from "@/psyche/types.ts"
import type { SomaticState } from "@/soma/types.ts"
import type { VulnerabilityState } from "@/vulnerability/types.ts"
import { renderSecondaryEmotion } from "./emotion-render.ts"
import {
  translateEmotionToFelt,
  translateEmotionTrajectoryToFelt,
  translateInstinctToFelt,
  translatePsycheToFelt,
  translateSomaticToFelt,
  translateVulnerabilityToFelt
} from "./render.ts"

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

  for (const [name, state] of secondaryEmotionStates) {
    if (!state.isActive) continue
    const rendered = renderSecondaryEmotion(name, state)
    if (rendered) sections.push(rendered)
  }

  if (input.heldBackBuffer && input.heldBackBuffer.entries.length > 0) {
    const hb = input.heldBackBuffer
    const surfacing = shouldSurface(hb, emotion)
    const heldLines: string[] = ["# Held Back"]

    if (surfacing) {
      heldLines.push("something you've been holding back is pressing to come out:")
      for (const entry of hb.entries.slice(0, 3)) {
        heldLines.push(`  - "${entry.content}" (held back because: ${formatReason(entry.reason)})`)
      }
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
      shameState
    })
    if (instabilityPrompt) {
      sections.push(instabilityPrompt)
    }
  }

  return sections
}
