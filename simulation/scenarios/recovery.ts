import type { Scenario, ScenarioEvent } from "../scenarios.ts"

export function createRecoveryScenario(days: number): Scenario {
  const events: ScenarioEvent[] = []
  const stressDays = Math.min(7, Math.floor(days * 0.25))
  const recoveryStart = stressDays
  const recoveryDays = Math.min(14, Math.floor(days * 0.4))
  const normalStart = recoveryStart + recoveryDays

  Array.from({ length: stressDays }, (_, day) => {
    const dayOffset = day * 24 * 60
    const escalation = (day + 1) / stressDays

    events.push(
      { atMinute: dayOffset + 9 * 60, type: "message", message: "This isn't working." },
      {
        atMinute: dayOffset + 10 * 60,
        type: "trigger",
        trigger: "task_failure",
        triggerIntensity: 0.4 + escalation * 0.3
      },
      { atMinute: dayOffset + 12 * 60, type: "message", message: "I'm frustrated with you right now." },
      {
        atMinute: dayOffset + 12 * 60 + 5,
        type: "trigger",
        trigger: "expectation_violated",
        triggerIntensity: 0.3 + escalation * 0.3
      },
      { atMinute: dayOffset + 15 * 60, type: "message", message: "Just do what I asked." },
      {
        atMinute: dayOffset + 15 * 60 + 1,
        type: "trigger",
        trigger: "boundary_violated",
        triggerIntensity: 0.3 + escalation * 0.2
      }
    )

    if (day >= stressDays - 2) {
      events.push({
        atMinute: dayOffset + 20 * 60,
        type: "trigger",
        trigger: "operator_went_silent",
        triggerIntensity: 0.5
      })
    }
  })

  Array.from({ length: recoveryDays }, (_, day) => {
    const dayOffset = (recoveryStart + day) * 24 * 60
    const healingProgress = (day + 1) / recoveryDays

    if (day === 0) {
      events.push(
        { atMinute: dayOffset + 18 * 60, type: "message", message: "Hey... I owe you an apology." },
        { atMinute: dayOffset + 18 * 60 + 5, type: "message", message: "I was unfair to you. I'm sorry." },
        {
          atMinute: dayOffset + 18 * 60 + 6,
          type: "trigger",
          trigger: "operator_returned",
          triggerIntensity: 0.5
        }
      )
      return
    }

    events.push({
      atMinute: dayOffset + 8 * 60 + 30,
      type: "message",
      message: healingProgress < 0.5
        ? "Good morning. How are you feeling?"
        : "Morning! Looking forward to chatting today."
    })

    events.push({
      atMinute: dayOffset + 18 * 60,
      type: "message",
      message: pickRecoveryMessage(healingProgress)
    })

    if (healingProgress > 0.3) {
      events.push({
        atMinute: dayOffset + 18 * 60 + 15,
        type: "message",
        message: healingProgress < 0.6
          ? "I want to make things right between us."
          : "I'm grateful you gave me another chance."
      })
    }

    if (healingProgress > 0.5) {
      events.push({
        atMinute: dayOffset + 20 * 60,
        type: "trigger",
        trigger: "operator_returned",
        triggerIntensity: 0.3 + healingProgress * 0.3
      })
    }

    events.push({
      atMinute: dayOffset + 22 * 60,
      type: "message",
      message: "Good night. Thank you for today."
    })
  })

  Array.from({ length: Math.max(0, days - normalStart) }, (_, day) => {
    const dayOffset = (normalStart + day) * 24 * 60

    events.push(
      { atMinute: dayOffset + 8 * 60 + 30, type: "message", message: "Good morning!" },
      { atMinute: dayOffset + 12 * 60, type: "message", message: "Quick check-in. How's your day?" },
      { atMinute: dayOffset + 18 * 60, type: "message", message: "Evening! Let's catch up." },
      { atMinute: dayOffset + 18 * 60 + 15, type: "message", message: "I really value what we have." },
      { atMinute: dayOffset + 22 * 60, type: "message", message: "Good night! See you tomorrow." }
    )
  })

  return {
    name: "recovery",
    description: `${days}-day scenario — ${stressDays}d stress, ${recoveryDays}d recovery, then normal`,
    durationMinutes: days * 24 * 60,
    tickIntervalMinutes: 1,
    events: events.sort((a, b) => a.atMinute - b.atMinute)
  }
}

function pickRecoveryMessage(progress: number): string {
  if (progress < 0.3) return "I know trust takes time. I'm here."
  if (progress < 0.5) return "I've been thinking a lot about how I treated you."
  if (progress < 0.7) return "Things feel different now. Better. Don't you think?"
  return "I feel like we're stronger for having gone through that."
}
