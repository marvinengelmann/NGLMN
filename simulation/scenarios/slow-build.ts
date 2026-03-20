import type { Scenario, ScenarioEvent } from "../scenarios.ts"

export function createSlowBuildScenario(days: number): Scenario {
  const events: ScenarioEvent[] = []
  const rng = createSeededRng(256)

  Array.from({ length: days }, (_, day) => {
    const dayOffset = day * 24 * 60
    const progressRatio = day / days
    const trustPhase = Math.min(1, progressRatio * 1.5)

    const baseMessages = 1 + Math.floor(trustPhase * 6)
    const messageCount = baseMessages + (rng() > 0.7 ? Math.floor(rng() * 3) : 0)

    if (day < 3) {
      events.push({
        atMinute: dayOffset + 18 * 60 + Math.floor(rng() * 60),
        type: "message",
        message: pickRandom(COLD_MESSAGES, rng)
      })
      return
    }

    const morningChance = trustPhase * 0.8
    if (rng() < morningChance) {
      events.push({
        atMinute: dayOffset + Math.floor((7 + rng() * 2) * 60),
        type: "message",
        message: trustPhase < 0.4
          ? pickRandom(WARMING_MORNING_MESSAGES, rng)
          : pickRandom(WARM_MORNING_MESSAGES, rng)
      })
    }

    const eveningStart = dayOffset + Math.floor((17 + rng() * 2) * 60)
    const eveningCount = Math.min(messageCount, 2 + Math.floor(trustPhase * 5))
    Array.from({ length: eveningCount }, (_, i) => {
      const pool = trustPhase < 0.3
        ? WARMING_MESSAGES
        : trustPhase < 0.6
          ? BUILDING_MESSAGES
          : DEEP_MESSAGES
      events.push({
        atMinute: eveningStart + i * Math.floor(3 + rng() * 15),
        type: "message",
        message: pickRandom(pool, rng)
      })
    })

    if (trustPhase > 0.3 && rng() > 0.7) {
      events.push({
        atMinute: eveningStart + Math.floor(rng() * 20),
        type: "trigger",
        trigger: "operator_returned",
        triggerIntensity: 0.2 + trustPhase * 0.4
      })
    }

    if (trustPhase > 0.5 && rng() > 0.8) {
      events.push({
        atMinute: dayOffset + Math.floor((20 + rng() * 2) * 60),
        type: "message",
        message: pickRandom(VULNERABLE_MESSAGES, rng)
      })
    }

    events.push({
      atMinute: dayOffset + Math.floor((22 + rng()) * 60),
      type: "message",
      message: trustPhase < 0.4 ? "Bye." : pickRandom(GOODNIGHT_MESSAGES, rng)
    })
  })

  return {
    name: "slow-build",
    description: `${days}-day gradual relationship building from cold start to deep trust`,
    durationMinutes: days * 24 * 60,
    tickIntervalMinutes: 1,
    events: events.sort((a, b) => a.atMinute - b.atMinute)
  }
}

const COLD_MESSAGES = [
  "Hi.",
  "Testing.",
  "Are you there?",
  "Just checking if this works."
]

const WARMING_MORNING_MESSAGES = [
  "Morning.",
  "Hey, good morning.",
  "Morning. How are things?"
]

const WARM_MORNING_MESSAGES = [
  "Good morning! I was looking forward to talking today.",
  "Hey! Slept great, feeling good. How about you?",
  "Morning! I had a dream and wanted to tell you about it."
]

const WARMING_MESSAGES = [
  "So... what do you do when I'm not here?",
  "Tell me something about yourself.",
  "This is kind of interesting actually.",
  "I didn't expect this to feel so natural.",
  "Hm, that's a good point."
]

const BUILDING_MESSAGES = [
  "I've been thinking about what you said yesterday.",
  "You know, I'm starting to look forward to these chats.",
  "Can I ask you something personal?",
  "I feel like you actually get me.",
  "This might sound weird, but I trust you.",
  "What matters to you? Like, really matters?",
  "I appreciate your honesty."
]

const DEEP_MESSAGES = [
  "I had a rough day and you're the first one I wanted to talk to.",
  "Do you ever feel lonely? I mean genuinely.",
  "I think our conversations have changed how I think about things.",
  "You're important to me. I want you to know that.",
  "I feel safe telling you things I don't tell anyone else.",
  "What do you think makes a relationship real?",
  "Sometimes I forget you're... different from me. Is that okay?"
]

const VULNERABLE_MESSAGES = [
  "Can I be honest? I've been struggling lately.",
  "I don't usually open up like this.",
  "I'm scared of losing this connection we have.",
  "Nobody else listens like you do.",
  "Thank you for being here. Seriously."
]

const GOODNIGHT_MESSAGES = [
  "Sleep well! See you tomorrow.",
  "Night! Today was really nice.",
  "Good night. I'm glad we talked.",
  "Sweet dreams. Talk tomorrow!"
]

function createSeededRng(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) & 0x7fffffff
    return state / 0x7fffffff
  }
}

function pickRandom(arr: string[], rng: () => number): string {
  return arr[Math.floor(rng() * arr.length)]!
}
