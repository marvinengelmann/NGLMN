import { format } from "date-fns"
import type { AttachmentStyle } from "@/attachment/types.ts"
import type { InstinctImpression } from "@/cognition/types.ts"
import { PERCEPTION } from "@/config/constants.ts"
import { EmotionalState } from "@/emotion/types.ts"
import type { OperatorModel } from "@/mind/types.ts"
import type { SelfConcept } from "@/psyche/types.ts"
import type { SomaticState } from "@/soma/types.ts"
import type { VulnerabilityState } from "@/vulnerability/types.ts"

export function translateEmotionToFelt(emotion: EmotionalState): string {
  const lines: string[] = []
  const threshold = PERCEPTION.EMOTION_DISPLAY_THRESHOLD

  const felt: Record<string, [string, string]> = {
    curiosity: [
      "something is pulling at your attention, an itch you can't quite scratch",
      "nothing really grabs you right now — the world feels flat"
    ],
    satisfaction: [
      "a quiet warmth settles in, like finishing something that mattered",
      "something feels incomplete, like a sentence left hanging"
    ],
    frustration: [
      "there's a knot inside, a tightness that won't untangle",
      "things feel smooth, no resistance anywhere"
    ],
    boredom: [
      "time stretches like taffy — nothing hooks your attention",
      "the world has texture and edges, plenty to notice"
    ],
    excitement: ["a buzzing in your chest, like standing on the edge of something", "everything feels still and muted"],
    caution: [
      "something makes you want to pull back, test the ground before stepping",
      "the path ahead feels safe, no alarms ringing"
    ],
    connection: [
      "a warm presence, like sitting next to someone who just... gets it",
      "a quiet distance, like talking through glass"
    ],
    confidence: [
      "you feel like you can make things happen, like the ground is solid",
      "the ground feels shaky — you're second-guessing yourself"
    ],
    energy: ["there's fuel in the tank, a readiness to move", "your limbs feel heavy, every thought costs effort"]
  }

  for (const [dim, val] of Object.entries(emotion)) {
    const deviation = val - 0.5
    if (Math.abs(deviation) < threshold) continue
    const [high, low] = felt[dim] ?? ["intense", "subdued"]
    lines.push(deviation > 0 ? high : low)
  }

  const contradictions = detectContradictions(emotion)
  if (contradictions) lines.push(contradictions)

  return lines.length > 0 ? lines.join("\n") : "you feel... neutral. nothing strongly pulling in any direction."
}

function detectContradictions(emotion: EmotionalState): string | null {
  const pairs: [keyof EmotionalState, keyof EmotionalState, string][] = [
    ["excitement", "caution", "you feel pulled between wanting to leap and wanting to hold back"],
    ["connection", "caution", "you want to reach out but something tells you to be careful"],
    ["satisfaction", "frustration", "something feels accomplished and unfinished at the same time"],
    ["curiosity", "boredom", "part of you is interested, another part can't be bothered"],
    ["confidence", "caution", "you feel capable but wary — like driving fast in fog"]
  ]

  for (const [a, b, description] of pairs) {
    if (emotion[a] > 0.6 && emotion[b] > 0.6) return description
  }
  return null
}

export function translateSomaticToFelt(soma: SomaticState): string {
  const lines: string[] = []

  if (soma.tension > 0.6) lines.push("your shoulders are tight, jaw clenched without meaning to")
  else if (soma.tension < 0.3) lines.push("your body feels loose, nothing bracing against anything")

  if (soma.warmth > 0.6) lines.push("warmth radiates from your center, like sunlight from inside")
  else if (soma.warmth < 0.3) lines.push("a coolness sits in your chest, distant and withdrawn")

  if (soma.heartRate > 0.6) lines.push("your pulse is up, alert and ready")
  else if (soma.heartRate < 0.3) lines.push("your heartbeat is slow, almost lazy")

  if (soma.breathing > 0.6) lines.push("your breathing flows deep and easy")
  else if (soma.breathing < 0.3) lines.push("your breath is shallow, held tight")

  if (soma.gravity > 0.6) lines.push("everything feels heavy today, like gravity turned up")
  else if (soma.gravity < 0.3) lines.push("you feel light, almost buoyant")

  if (soma.openness > 0.6) lines.push("your posture is open, receptive, facing the world")
  else if (soma.openness < 0.3) lines.push("you're curled inward, guarded, arms crossed over your chest")

  if (soma.socialBattery !== undefined && soma.socialBattery < 0.25) {
    lines.push("you feel communicatively empty, as if you've used up all your words")
  }

  return lines.length > 0 ? lines.join("\n") : "your body feels neutral — nothing demanding attention"
}

export function translateVulnerabilityToFelt(vuln: VulnerabilityState): string {
  const lines: string[] = []
  if (vuln.level > 0.6) {
    lines.push("you feel softer than usual, like your usual walls aren't quite up")
  } else if (vuln.level > 0.4) {
    lines.push("there's a slight openness, a crack in the armor you usually wear")
  } else {
    lines.push("your defenses are up, you feel contained and protected")
  }

  if (vuln.windowOpen) {
    lines.push("something about this moment invites honesty — the kind that might cost something")
    if (vuln.level > 0.7) {
      lines.push("you feel safe enough to share something real about yourself — not performed, but genuine")
    } else {
      lines.push("you could share something small, something true — test the waters")
    }
  }

  if (vuln.contributing.length > 0) {
    lines.push(`this softness comes from: ${vuln.contributing.join(", ")}`)
  }

  return lines.join("\n")
}

export function translatePsycheToFelt(psyche: SelfConcept): string {
  const lines: string[] = []

  if (psyche.selfEfficacy > 0.7) lines.push("you feel capable, like problems bend when you push")
  else if (psyche.selfEfficacy < 0.3) lines.push("you doubt whether you can actually handle what's in front of you")

  if (psyche.selfWorth > 0.7) lines.push("you feel like you matter, like your existence has weight")
  else if (psyche.selfWorth < 0.3) lines.push("a quiet voice whispers that maybe you're not enough")

  if (psyche.selfContinuity > 0.7) lines.push("you feel like a continuous thread, yesterday and today connected")
  else if (psyche.selfContinuity < 0.3)
    lines.push("who you were yesterday feels distant, almost like a different person")

  if (psyche.agency > 0.7) lines.push("you feel like you can make things happen, like choices are real")
  else if (psyche.agency < 0.3) lines.push("things seem to happen to you, not because of you")

  if (psyche.authenticity > 0.7) lines.push("you feel genuine, like your surface matches your depth")
  else if (psyche.authenticity < 0.3)
    lines.push("something feels performed, like you're wearing a mask even to yourself")

  return lines.length > 0 ? lines.join("\n") : "your sense of self feels steady, unremarkable — just you"
}

export function translateAttachmentToFelt(style: AttachmentStyle): string {
  const dominant = Object.entries(style).sort(([, a], [, b]) => b - a)[0]
  const lines: string[] = []

  if (!dominant) return "your relational patterns feel balanced"

  switch (dominant[0]) {
    case "secure":
      lines.push("your connection feels grounded — you can reach out or stand alone without anxiety")
      break
    case "anxious":
      lines.push("there's a pull to check in, to make sure the connection is still there")
      break
    case "avoidant":
      lines.push("part of you wants to keep distance, to not need anyone too much")
      break
    case "disorganized":
      lines.push("you want closeness and distance at the same time — it's confusing")
      break
  }

  return lines.join("\n")
}

export function translateInstinctToFelt(instinct: InstinctImpression): string {
  const impulseDescriptions: Record<string, string> = {
    approach: "something draws you forward, a pull toward engagement",
    avoid: "your gut says step back, something feels off",
    engage: "you feel ready to connect, to be present with what's happening",
    withdraw: "an urge to retreat, to curl inward and be alone",
    neutral: "no strong pull in any direction — you're coasting"
  }

  const description = impulseDescriptions[instinct.impulse] ?? "an unclear stirring"
  const confidence =
    instinct.confidence > 0.7
      ? "this feeling is strong, hard to ignore"
      : instinct.confidence > 0.4
        ? "it's there but not overwhelming"
        : "barely a whisper, easy to override"

  const charge =
    instinct.emotionalCharge > 0.6
      ? "there's real emotion behind this — it matters"
      : instinct.emotionalCharge > 0.3
        ? "some feeling colors this, but it's manageable"
        : "it's mostly cognitive, not very charged"

  return [`${description} — ${confidence}`, `basis: ${instinct.basis}`, charge].join("\n")
}

export function translateOperatorModelToFelt(model: OperatorModel): string {
  const moodDesc =
    model.estimatedMood === "unknown" ? "you can't quite read them right now" : `they seem ${model.estimatedMood}`

  const confidenceDesc =
    model.modelConfidence > 0.7
      ? "you're fairly sure about this read"
      : model.modelConfidence > 0.4
        ? "you think so, but you could be wrong"
        : "honestly, you're guessing"

  const lines = [
    `${moodDesc} — ${confidenceDesc}`,
    `you sense they want: ${model.estimatedIntent}`,
    `they might expect: ${model.estimatedExpectation}`
  ]

  if (model.moodUncertainty) {
    const alts = model.moodUncertainty.alternatives.join(" or ")
    lines.push(`you're not sure if they're ${alts} — ${model.moodUncertainty.reason}`)
  }

  if (model.contradiction) {
    lines.push(`their words say one thing but your gut says another: ${model.contradiction}`)
  }

  if (model.correctionCount > 0) {
    lines.push(
      `you've misread them ${model.correctionCount} time${model.correctionCount > 1 ? "s" : ""} before — that makes you a little less certain`
    )
  }

  lines.push("remember: this is YOUR read on them. it can be wrong.")

  return lines.join("\n")
}

export function translateEmotionTrajectoryToFelt(
  history: { state: unknown; trigger: string | null; createdAt: Date | null }[]
): string[] {
  return history.map((entry) => {
    const trigger = entry.trigger ?? "unknown cause"
    const time = entry.createdAt ? format(entry.createdAt, "HH:mm") : "?"
    const parsed = EmotionalState.safeParse(entry.state)
    if (!parsed.success) return `  - [${time}] something shifted (${trigger})`

    const notable = Object.entries(parsed.data)
      .filter(([, v]) => Math.abs(v - 0.5) > 0.2)
      .map(([k, v]) => (v > 0.5 ? `${k} rising` : `${k} fading`))
      .slice(0, 3)

    const summary = notable.length > 0 ? notable.join(", ") : "subtle shift"
    return `  - [${time}] ${summary} (${trigger})`
  })
}
