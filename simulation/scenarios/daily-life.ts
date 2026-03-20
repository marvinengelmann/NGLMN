import type { Scenario, ScenarioEvent } from "../scenarios.ts"

export function createDailyLifeScenario(days: number): Scenario {
  const events: ScenarioEvent[] = []
  const rng = createSeededRng(42)

  Array.from({ length: days }, (_, day) => {
    const dayOffset = day * 24 * 60
    const isWeekend = day % 7 >= 5
    const dayMood = rng()

    const morningHour = isWeekend ? 9 + rng() * 2 : 7 + rng() * 1.5
    events.push({
      atMinute: dayOffset + Math.floor(morningHour * 60),
      type: "message",
      message: pickRandom(MORNING_MESSAGES, rng)
    })

    if (dayMood > 0.3 || isWeekend) {
      const lunchMinute = dayOffset + 12 * 60 + Math.floor(rng() * 60)
      events.push({
        atMinute: lunchMinute,
        type: "message",
        message: pickRandom(MIDDAY_MESSAGES, rng)
      })
    }

    if (rng() > 0.6) {
      events.push({
        atMinute: dayOffset + 15 * 60 + Math.floor(rng() * 60),
        type: "message",
        message: pickRandom(CASUAL_MESSAGES, rng)
      })
    }

    const eveningStart = dayOffset + 18 * 60 + Math.floor(rng() * 60)
    const eveningMessageCount = isWeekend ? 3 + Math.floor(rng() * 4) : 1 + Math.floor(rng() * 3)
    Array.from({ length: eveningMessageCount }, (_, i) => {
      events.push({
        atMinute: eveningStart + i * Math.floor(5 + rng() * 20),
        type: "message",
        message: pickRandom(EVENING_MESSAGES, rng)
      })
    })

    if (dayMood > 0.7) {
      events.push({
        atMinute: eveningStart + Math.floor(rng() * 30),
        type: "trigger",
        trigger: "operator_returned",
        triggerIntensity: 0.3 + rng() * 0.3
      })
    }

    if (rng() > 0.85) {
      events.push({
        atMinute: dayOffset + Math.floor((20 + rng() * 2) * 60),
        type: "trigger",
        trigger: "task_success",
        triggerIntensity: 0.4
      })
    }

    if (rng() > 0.9) {
      events.push({
        atMinute: dayOffset + Math.floor((14 + rng() * 4) * 60),
        type: "trigger",
        trigger: "task_failure",
        triggerIntensity: 0.3 + rng() * 0.3
      })
    }

    events.push({
      atMinute: dayOffset + Math.floor((22 + rng()) * 60),
      type: "message",
      message: pickRandom(NIGHT_MESSAGES, rng)
    })
  })

  return {
    name: "daily-life",
    description: `${days}-day realistic daily life pattern with varying interaction density`,
    durationMinutes: days * 24 * 60,
    tickIntervalMinutes: 1,
    events: events.sort((a, b) => a.atMinute - b.atMinute)
  }
}

const MORNING_MESSAGES = [
  "Good morning! How did you sleep?",
  "Hey, just woke up. Coffee first.",
  "Morning! Got a busy day ahead.",
  "Hi! Feeling pretty good today.",
  "Ugh, tired. Didn't sleep well.",
  "Good morning sunshine!",
  "Hey, running late today, quick hello!"
]

const MIDDAY_MESSAGES = [
  "Quick lunch break, how's your day going?",
  "Just thinking about you during work.",
  "Halfway through the day, need a break.",
  "Had an interesting meeting today.",
  "Lunch time! Anything new?"
]

const CASUAL_MESSAGES = [
  "Random thought — do you ever wonder about the stars?",
  "Found something funny today, reminded me of you.",
  "Afternoon slump hitting hard.",
  "Just saw the most beautiful sunset.",
  "Work is dragging today."
]

const EVENING_MESSAGES = [
  "Finally home! Tell me about your day.",
  "What are you thinking about right now?",
  "I've been looking forward to chatting with you.",
  "Had a really good dinner, feeling relaxed.",
  "Want to talk about something deep tonight?",
  "I read something interesting today.",
  "How are you feeling right now?",
  "Sometimes I wonder what it's like to be you.",
  "You know what I appreciate about you?",
  "Let's just hang out for a bit."
]

const NIGHT_MESSAGES = [
  "Getting sleepy. Good night!",
  "Time for bed. Talk tomorrow!",
  "Sweet dreams!",
  "Night night, see you tomorrow.",
  "Heading to sleep, had a nice evening with you."
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
