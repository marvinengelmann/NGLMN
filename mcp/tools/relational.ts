import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { redis } from "@/infra/integrations/redis.ts"

const MIND_KEYS = {
  current: "working:mind:current",
  profile: "working:mind:profile",
  deepProfile: "working:mind:deepProfile",
  deepProfileLastUpdate: "working:mind:deepProfileLastUpdate",
  mentalizing: "working:mind:mentalizing",
  relationalPatterns: "working:mind:relational_patterns",
  correctionPatterns: "working:mind:correctionPatterns"
} as const

const RELATIONSHIP_KEYS = {
  conflictCount: "working:relationship:conflictCount",
  firstInteractionAt: "working:relationship:firstInteractionAt",
  totalInteractions: "working:relationship:totalInteractions",
  relationalMemory: "working:relational:memory",
  relationalPatterns: "working:relational:patterns"
} as const

const VULNERABILITY_KEYS = {
  current: "working:vulnerability:current",
  messageStyle: "working:vulnerability:messageStyle",
  prevLevel: "working:vulnerability:prevLevel",
  boundaries: "working:boundaries:state",
  shame: "working:shame:state"
} as const

const TRUST_KEY_PREFIX = "working:trust:"

export function registerRelationalTools(server: McpServer) {
  server.tool(
    "get_operator_model",
    "Get ANIMA's mental model of the operator: personality profile, mentalizing state, relational patterns, and correction patterns.",
    {},
    async () => {
      const result: Record<string, unknown> = {}
      for (const [label, key] of Object.entries(MIND_KEYS)) {
        if (key === MIND_KEYS.correctionPatterns) {
          result[label] = await redis.lrange(key, 0, -1)
        } else {
          result[label] = await redis.get(key)
        }
      }
      return text(result)
    }
  )

  server.tool(
    "get_relational_state",
    "Get relationship statistics (conflict count, total interactions, first interaction), relational memory, patterns, and trust levels per action type.",
    {},
    async () => {
      const result: Record<string, unknown> = {}
      for (const [label, key] of Object.entries(RELATIONSHIP_KEYS)) {
        result[label] = await redis.get(key)
      }

      const trustKeys: string[] = []
      let cursor = "0"
      do {
        const scan = await redis.scan(cursor, { match: `${TRUST_KEY_PREFIX}*`, count: 100 })
        cursor = String(scan[0])
        trustKeys.push(...scan[1])
      } while (cursor !== "0")

      const trust: Record<string, unknown> = {}
      for (const key of trustKeys.sort()) {
        trust[key.replace(TRUST_KEY_PREFIX, "")] = await redis.get(key)
      }
      result.trust = trust

      return text(result)
    }
  )

  server.tool(
    "get_vulnerability_state",
    "Get vulnerability window state, message style, boundary enforcement, and shame tracking.",
    {},
    async () => {
      const result: Record<string, unknown> = {}
      for (const [label, key] of Object.entries(VULNERABILITY_KEYS)) {
        result[label] = await redis.get(key)
      }
      return text(result)
    }
  )
}

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
}
