import { getValidatedRedis, redis } from "@/integrations/redis.ts"
import { ActiveEvolution, CodeProposal, EvolutionCycleResult } from "./types.ts"

const KEYS = {
  EVOLUTION_ACTIVE: "working:evolution:active",
  EVOLUTION_PENDING_PROPOSAL: "working:evolution:pendingProposal",
  EVOLUTION_OUTCOME: "working:evolution:outcome",
  EVOLUTION_COUNTER: "working:evolution:counter"
} as const

export async function getActiveEvolution(): Promise<ActiveEvolution | null> {
  return getValidatedRedis(KEYS.EVOLUTION_ACTIVE, ActiveEvolution)
}

export async function setActiveEvolution(evolution: ActiveEvolution): Promise<void> {
  await redis.set(KEYS.EVOLUTION_ACTIVE, evolution)
}

export async function clearActiveEvolution(): Promise<void> {
  await redis.del(KEYS.EVOLUTION_ACTIVE)
}

export async function getPendingEvolutionProposal(): Promise<CodeProposal | null> {
  return getValidatedRedis(KEYS.EVOLUTION_PENDING_PROPOSAL, CodeProposal)
}

export async function setPendingEvolutionProposal(proposal: CodeProposal): Promise<void> {
  await redis.set(KEYS.EVOLUTION_PENDING_PROPOSAL, proposal, { ex: 86400 })
}

export async function clearPendingEvolutionProposal(): Promise<void> {
  await redis.del(KEYS.EVOLUTION_PENDING_PROPOSAL)
}

export async function getEvolutionCycleResult(): Promise<EvolutionCycleResult | null> {
  return getValidatedRedis(KEYS.EVOLUTION_OUTCOME, EvolutionCycleResult)
}

export async function setEvolutionCycleResult(outcome: EvolutionCycleResult): Promise<void> {
  await redis.set(KEYS.EVOLUTION_OUTCOME, outcome, { ex: 3600 })
}

export async function clearEvolutionCycleResult(): Promise<void> {
  await redis.del(KEYS.EVOLUTION_OUTCOME)
}

export async function getNextEvolutionNumber(): Promise<number> {
  return redis.incr(KEYS.EVOLUTION_COUNTER)
}
