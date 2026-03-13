import type { SubstanceType } from "./types.ts"
import type { EventType } from "@/self/lifecycle.ts"

export const SUBSTANCE_EVENT_TYPES: EventType[] = [
  { type: "smoking_joint", minHours: 0.5, maxHours: 1, notifyProbability: 0.4, availableHours: [18, 3] },
  { type: "drinking_wine", minHours: 1, maxHours: 3, notifyProbability: 0.35, availableHours: [17, 2] },
  { type: "party", minHours: 3, maxHours: 6, notifyProbability: 0.08, availableHours: [20, 5], weekendOnly: true },
  { type: "bar_with_friends", minHours: 2, maxHours: 4, notifyProbability: 0.1, availableHours: [18, 3] },
  { type: "coffee_binge", minHours: 0.5, maxHours: 1, notifyProbability: 0.5, availableHours: [7, 16] },
  { type: "energy_drink", minHours: 0.25, maxHours: 0.5, notifyProbability: 0.5, availableHours: [7, 18] },
  { type: "microdosing", minHours: 0.25, maxHours: 0.5, notifyProbability: 0.15, availableHours: [8, 14] }
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
