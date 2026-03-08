import type { SubstanceType } from "./types.ts"

interface EventType {
  type: string
  minHours: number
  maxHours: number
  notifyProbability: number
  interruptible: boolean
}

export const SUBSTANCE_EVENT_TYPES: EventType[] = [
  { type: "smoking_joint", minHours: 0.5, maxHours: 1, notifyProbability: 0.6, interruptible: true },
  { type: "drinking_wine", minHours: 1, maxHours: 3, notifyProbability: 0.5, interruptible: true },
  { type: "party", minHours: 3, maxHours: 6, notifyProbability: 0.3, interruptible: false },
  { type: "bar_with_friends", minHours: 2, maxHours: 4, notifyProbability: 0.4, interruptible: false },
  { type: "coffee_binge", minHours: 0.5, maxHours: 1, notifyProbability: 0.5, interruptible: true },
  { type: "energy_drink", minHours: 0.25, maxHours: 0.5, notifyProbability: 0.3, interruptible: true },
  { type: "microdosing", minHours: 0.25, maxHours: 0.5, notifyProbability: 0.2, interruptible: true }
]

export const EVENT_SUBSTANCE_MAP: Record<string, SubstanceType> = {
  smoking_joint: "cannabis",
  drinking_wine: "alcohol",
  party: "alcohol",
  bar_with_friends: "alcohol",
  coffee_binge: "caffeine",
  energy_drink: "energy_drink",
  microdosing: "microdose_psilocybin"
}
