import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { redis } from "@/infra/integrations/redis.ts"

const COGNITION_KEYS = {
  attention: "working:cognition:attention",
  bias: "working:cognition:bias",
  dmn: "working:cognition:dmn",
  forecasting: "working:cognition:forecasting",
  habitState: "working:cognition:habitState",
  instinctLastImpression: "working:cognition:instinct:lastImpression",
  procrastination: "working:cognition:procrastination",
  metacognition: "working:metacognition:state",
  regulation: "working:regulation:state"
} as const

const POLYPHONY_KEYS = {
  lastDialog: "working:polyphony:lastDialog",
  voiceDominanceHistory: "working:polyphony:voiceDominanceHistory"
} as const

export function registerCognitionTools(server: McpServer) {
  server.tool(
    "get_cognition_state",
    "Get cognitive state: attention focus, active biases, Default Mode Network, forecasting, habits, instinct impressions, procrastination, metacognition, and emotion regulation strategy.",
    {},
    async () => {
      const result: Record<string, unknown> = {}
      for (const [label, key] of Object.entries(COGNITION_KEYS)) {
        result[label] = await redis.get(key)
      }
      return text(result)
    }
  )

  server.tool(
    "get_polyphony_state",
    "Get inner polyphony state: last multi-voice dialog (with dominant voice, conflict, and reasoning) and voice dominance history.",
    {},
    async () => {
      const lastDialog = await redis.get(POLYPHONY_KEYS.lastDialog)
      const dominanceHistory = await redis.lrange(POLYPHONY_KEYS.voiceDominanceHistory, 0, -1)
      return text({ lastDialog, dominanceHistory })
    }
  )
}

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
}
