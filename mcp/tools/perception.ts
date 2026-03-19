import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { redis } from "@/infra/integrations/redis.ts"

const PERCEPTION_KEYS = {
  latest: "working:perception:latest",
  ultradian: "working:perception:ultradian",
  lastGitCommitSha: "working:perception:lastGitCommitSha",
  lastWeatherCondition: "working:perception:lastWeatherCondition",
  anticipation: "working:anticipation:state",
  noveltyState: "working:novelty:state",
  noveltySurprise: "working:novelty:surprise",
  operatorLocation: "working:operator:location",
  operatorLastActivity: "working:operator:lastActivity",
  weather: "working:weather:latest"
} as const

export function registerPerceptionTools(server: McpServer) {
  server.tool(
    "get_perception_state",
    "Get ANIMA's current perception: latest sensory summary, ultradian rhythm, anticipation, novelty/surprise, operator location & activity, weather, and git activity.",
    {},
    async () => {
      const result: Record<string, unknown> = {}
      for (const [label, key] of Object.entries(PERCEPTION_KEYS)) {
        result[label] = await redis.get(key)
      }
      return text(result)
    }
  )
}

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
}
