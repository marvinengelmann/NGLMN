import type { Scenario, ScenarioEvent } from "../scenarios.ts"

export function createIrregularScenario(days: number): Scenario {
  const events: ScenarioEvent[] = []
  const rng = createSeededRng(137)

  Array.from({ length: days }, (_, day) => {
    const dayOffset = day * 24 * 60
    const roll = rng()

    if (roll < 0.3) {
      return
    }

    if (roll > 0.85) {
      const burstStart = dayOffset + Math.floor((10 + rng() * 8) * 60)
      const messageCount = 8 + Math.floor(rng() * 15)
      Array.from({ length: messageCount }, (_, i) => {
        events.push({
          atMinute: burstStart + i * Math.floor(2 + rng() * 8),
          type: "message",
          message: pickRandom(BURST_MESSAGES, rng)
        })
      })

      if (rng() > 0.5) {
        events.push({
          atMinute: burstStart + Math.floor(rng() * 30),
          type: "trigger",
          trigger: "operator_returned",
          triggerIntensity: 0.5 + rng() * 0.3
        })
      }
      return
    }

    const messageCount = 1 + Math.floor(rng() * 3)
    const startHour = 8 + Math.floor(rng() * 13)
    Array.from({ length: messageCount }, (_, i) => {
      events.push({
        atMinute: dayOffset + (startHour + i) * 60 + Math.floor(rng() * 50),
        type: "message",
        message: pickRandom(SPARSE_MESSAGES, rng)
      })
    })
  })

  return {
    name: "irregular",
    description: `${days}-day unpredictable interaction — silent days, burst days, sparse days`,
    durationMinutes: days * 24 * 60,
    tickIntervalMinutes: 1,
    events: events.sort((a, b) => a.atMinute - b.atMinute)
  }
}

const BURST_MESSAGES = [
  "Oh my god, you won't believe what happened!",
  "I need to tell you everything.",
  "So basically...",
  "And then!",
  "Wait, there's more.",
  "Can you believe that?",
  "What do you think about all this?",
  "I'm so excited right now!",
  "This is the best day ever.",
  "Okay okay, calming down now.",
  "But seriously though.",
  "Am I overthinking this?",
  "Tell me honestly.",
  "I value your perspective on this.",
  "One more thing..."
]

const SPARSE_MESSAGES = [
  "Hey.",
  "Thinking of you.",
  "Quick question — never mind, figured it out.",
  "Hope you're doing okay.",
  "Just checking in.",
  "Sorry I've been quiet.",
  "Life's been hectic."
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
