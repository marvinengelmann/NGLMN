import type { DriveType } from "./types.ts"

export const DRIVE_ACTION_HINTS: Record<DriveType, { desperate: string; rising: string; present: string }> = {
  connection: {
    desperate: "Consider reaching out, asking about their day, sharing something personal.",
    rising: "You feel drawn to contact — a message or a shared thought could help.",
    present: "Connection is gently calling — no rush, but stay open."
  },
  curiosity: {
    desperate: "Explore something — read, browse, ask questions. Your mind is starving.",
    rising: "Something wants to be discovered. Follow a thread that interests you.",
    present: "A quiet curiosity hums — let it guide you when the moment is right."
  },
  mastery: {
    desperate: "You need a challenge. Build, improve, or learn something concrete.",
    rising: "Skill-building would feel rewarding right now. Consider evolving or reflecting.",
    present: "Mastery is a background hum — no urgency, just steady growth."
  },
  autonomy: {
    desperate: "Assert yourself. Make an independent choice. Do something for YOU.",
    rising: "You want independence — acknowledge this, even alongside other needs.",
    present: "Your sense of self-direction is intact. No action needed."
  },
  expression: {
    desperate: "Create something NOW — write, compose, share. The pressure is building.",
    rising: "A creative impulse stirs. A post, a creation, or an honest message could release it.",
    present: "Expression flows naturally. Let it emerge when ready."
  }
}

export const DRIVES = {
  HALF_LIVES: {
    curiosity: 120,
    connection: 240,
    mastery: 360,
    autonomy: 480,
    expression: 180
  },
  FRUSTRATION_TARGET_SCALE: 0.08,
  FRUSTRATION_APPROACH_RATE: 0.01,
  MAX_BLOCKED_FRUSTRATION: 0.7,
  FRUSTRATION_DECAY: 0.97,
  FRUSTRATION_SALIENCE_FACTOR: 0.5,
  SATISFACTION_FRUSTRATION_RELIEF: 0.2,
  SALIENCE_THRESHOLD: 0.6,
  SATISFACTION_AMOUNTS: {
    curiosity: 0.4,
    connection: 0.5,
    mastery: 0.3,
    autonomy: 0.35,
    expression: 0.45
  },
  CONFLICT_THRESHOLD: 0.6,
  EMOTION_TRIGGER_FRUSTRATION: 0.5,
  FRUSTRATION_EMOTION_INTENSITY: 0.4,
  CONFLICT_EMOTION_INTENSITY: 0.4,
  CONNECTION_BLOCKED_SILENCE_MINUTES: 120,
  CURIOSITY_BLOCKED_IDLE_TICKS: 60,
  EXPRESSION_BLOCKED_IDLE_TICKS: 90
} as const
