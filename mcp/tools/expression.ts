import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { redis } from "@/infra/integrations/redis.ts"

const COMMUNICATION_KEYS = {
  idiolect: "working:communication:idiolect",
  register: "working:communication:register",
  conversationBuffer: "working:conversation:buffer",
  conversationPatterns: "working:conversation:patterns",
  waitingSince: "working:conversation:waitingSince"
} as const

const DREAM_KEYS = {
  state: "working:dream:state",
  afterglow: "working:dream:afterglow",
  insights: "working:dream:insights",
  narrative: "working:dream:narrative",
  lastRun: "working:dream:lastRun",
  creativityUrge: "working:creativity:urge"
} as const

export function registerExpressionTools(server: McpServer) {
  server.tool(
    "get_communication_state",
    "Get ANIMA's communication state: idiolect (adopted speech patterns), register (formal/informal), conversation buffer, patterns, and how long waiting for a reply.",
    {},
    async () => {
      const result: Record<string, unknown> = {}
      for (const [label, key] of Object.entries(COMMUNICATION_KEYS)) {
        result[label] = await redis.get(key)
      }
      return text(result)
    }
  )

  server.tool(
    "get_dream_state",
    "Get ANIMA's dream and creativity state: current dream processing, afterglow, insights, narrative, last run time, and creative urge level.",
    {},
    async () => {
      const result: Record<string, unknown> = {}
      for (const [label, key] of Object.entries(DREAM_KEYS)) {
        result[label] = await redis.get(key)
      }
      return text(result)
    }
  )
}

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
}
