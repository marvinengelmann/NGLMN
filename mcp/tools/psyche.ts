import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { redis } from "@/infra/integrations/redis.ts"

const PSYCHE_KEYS = {
  current: "working:psyche:current",
  aspirations: "working:psyche:aspirations",
  fears: "working:psyche:fears",
  heldback: "working:psyche:heldback",
  growthArcs: "working:psyche:growthArcs",
  existentialQuestions: "working:psyche:existentialQuestions",
  identityStatements: "working:psyche:identityStatements",
  narrativeSummary: "working:psyche:narrativeSummary",
  recentNarratives: "working:psyche:recentNarratives"
} as const

export function registerPsycheTools(server: McpServer) {
  server.tool(
    "get_psyche_state",
    "Get ANIMA's self-concept: current psyche state, aspirations, fears, held-back thoughts, growth arcs, existential questions, identity statements, and narrative summary.",
    {},
    async () => {
      const result: Record<string, unknown> = {}
      for (const [label, key] of Object.entries(PSYCHE_KEYS)) {
        result[label] = await redis.get(key)
      }
      return text(result)
    }
  )
}

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
}
