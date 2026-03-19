import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { redis } from "@/infra/integrations/redis.ts"

const NEURO_KEYS = {
  neuromodulation: "working:affect:neuromodulation",
  driveState: "working:drive:state",
  alteredState: "working:altered:state",
  flowQualifyingTicks: "working:altered:flow_qualifying_ticks"
} as const

const FEP_KEYS = {
  state: "working:fep:state",
  history: "working:fep:history",
  priorEmotion: "working:fep:prior_emotion",
  priorSoma: "working:fep:prior_soma"
} as const

export function registerAffectStateTools(server: McpServer) {
  server.tool(
    "get_neuromodulation_state",
    "Get neuromodulatory state (dopamine, serotonin, norepinephrine, oxytocin, cortisol, endorphins, GABA), motivational drives, and altered consciousness state (flow, dissociation).",
    {},
    async () => {
      const result: Record<string, unknown> = {}
      for (const [label, key] of Object.entries(NEURO_KEYS)) {
        result[label] = await redis.get(key)
      }
      return text(result)
    }
  )

  server.tool(
    "get_fep_state",
    "Get Free Energy Principle state: current free energy, prediction error channels (9 types), precision weights, prior emotion/soma states, and FE history.",
    {},
    async () => {
      const result: Record<string, unknown> = {}
      for (const [label, key] of Object.entries(FEP_KEYS)) {
        result[label] = await redis.get(key)
      }
      return text(result)
    }
  )
}

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
}
