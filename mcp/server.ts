import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { registerEmotionTools } from "./tools/emotion.ts"
import { registerGoalsTools } from "./tools/goals.ts"
import { registerHealthTools } from "./tools/health.ts"
import { registerMemoryTools } from "./tools/memory.ts"
import { registerTickLogTools } from "./tools/tick-log.ts"
import { registerWorkingMemoryTools } from "./tools/working-memory.ts"

const server = new McpServer({
  name: `anima (${process.env.DOTENV ?? ".env.local"})`,
  version: "1.0.0"
})

registerWorkingMemoryTools(server)
registerTickLogTools(server)
registerEmotionTools(server)
registerMemoryTools(server)
registerGoalsTools(server)
registerHealthTools(server)

const transport = new StdioServerTransport()
await server.connect(transport)
