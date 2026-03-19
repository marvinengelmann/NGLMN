import { getConversationBuffer } from "@/expression/communication/state.ts"
import { vectorIndex } from "@/infra/integrations/vector.ts"
import type { WriteBuffer } from "@/infra/lib/buffer.ts"
import { log } from "@/infra/lib/logger.ts"
import { runProbabilisticTasks } from "@/infra/lib/probabilistic.ts"
import { maybeConsolidate } from "@/memory/autobiography.ts"
import { EPISODIC_LIFECYCLE } from "@/memory/constants.ts"
import {
  applyGoalPriorityDecay,
  detectOverdueGoals,
  detectStaleGoals,
  markGoalOverdue,
  markGoalStale
} from "@/memory/goals/lifecycle.ts"
import { extractEntitiesFromConversation } from "@/memory/graph/extract.ts"
import { decaySalience } from "@/memory/graph/forget.ts"
import { GRAPH_CONSTANTS } from "@/memory/graph/types.ts"
import { addKeyMoment, getRelationalMemoryState } from "@/memory/relational.ts"
import { detectRituals } from "@/memory/rituals.ts"

const REDIS_RELATIONAL_MEMORY = "working:relational:memory"

const THRESHOLDS = {
  STRONG_CONNECTION: 0.7,
  MIN_CONVERSATION_SLOTS_FOR_RITUALS: 3
} as const

/**
 * Maintain relational memory, goals, memory consolidation, entity extraction, and salience decay.
 */
export async function maintainMemory(
  action: string,
  reasoning: string,
  connection: number,
  responseSent: boolean,
  hasMessages: boolean,
  messageTexts: string[],
  responseText: string | undefined,
  tickId: string,
  buffer: WriteBuffer
): Promise<void> {
  if (responseSent && hasMessages) {
    await maintainRelationalMemory(action, reasoning, connection, buffer)
  }

  await maintainGoals()

  await runProbabilisticTasks([
    {
      name: "memory_pressure_check",
      probability: 1,
      execute: async () => {
        const infoResult = await vectorIndex.info()
        const episodeCount = infoResult.namespaces[""]?.vectorCount ?? 0
        if (episodeCount > EPISODIC_LIFECYCLE.EPISODE_PRESSURE_THRESHOLD) {
          buffer.stage("working:memory:pressure", true)
          log.info("Memory pressure flag set", { episodeCount })
        }
      }
    },
    {
      name: "memory_consolidation",
      probability: 1,
      execute: maybeConsolidate
    },
    {
      name: "entity_extraction",
      probability: GRAPH_CONSTANTS.ENTITY_EXTRACTION_PROBABILITY,
      condition: responseSent,
      execute: () => extractEntitiesFromConversation(messageTexts, responseText ?? "", tickId)
    },
    {
      name: "salience_decay",
      probability: GRAPH_CONSTANTS.SALIENCE_DECAY_PROBABILITY,
      execute: async () => {
        await decaySalience()
      }
    }
  ])
}

async function maintainRelationalMemory(
  action: string,
  reasoning: string,
  connection: number,
  buffer: WriteBuffer
): Promise<void> {
  let relationalState = await getRelationalMemoryState()

  if (connection > THRESHOLDS.STRONG_CONNECTION) {
    relationalState = addKeyMoment(relationalState, `${action}: ${reasoning.slice(0, 100)}`, connection)
    buffer.stage(REDIS_RELATIONAL_MEMORY, relationalState)
  }

  const conversationSlots = await getConversationBuffer()
  if (conversationSlots.length >= THRESHOLDS.MIN_CONVERSATION_SLOTS_FOR_RITUALS) {
    const updatedRituals = detectRituals(conversationSlots, relationalState.rituals)
    if (JSON.stringify(updatedRituals) !== JSON.stringify(relationalState.rituals)) {
      buffer.stage(REDIS_RELATIONAL_MEMORY, { ...relationalState, rituals: updatedRituals })
    }
  }
}

async function maintainGoals(): Promise<void> {
  const staleGoals = await detectStaleGoals()
  await Promise.all(staleGoals.map((goal) => markGoalStale(goal.id)))

  const overdueGoals = await detectOverdueGoals()
  await Promise.all(overdueGoals.map((goal) => markGoalOverdue(goal.id)))

  await applyGoalPriorityDecay()
}
