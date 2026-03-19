import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { registerAdminTools } from "./tools/admin.ts"
import { registerAffectStateTools } from "./tools/affect-state.ts"
import { registerCognitionTools } from "./tools/cognition.ts"
import { registerEmotionTools } from "./tools/emotion.ts"
import { registerExpressionTools } from "./tools/expression.ts"
import { registerGoalsTools } from "./tools/goals.ts"
import { registerHealthTools } from "./tools/health.ts"
import { registerHistoryTools } from "./tools/history.ts"
import { registerLearningTools } from "./tools/learning.ts"
import { registerLifecycleTools } from "./tools/lifecycle.ts"
import { registerMemoryTools } from "./tools/memory.ts"
import { registerPerceptionTools } from "./tools/perception.ts"
import { registerPsycheTools } from "./tools/psyche.ts"
import { registerRelationalTools } from "./tools/relational.ts"
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
registerRelationalTools(server)
registerPsycheTools(server)
registerCognitionTools(server)
registerAffectStateTools(server)
registerPerceptionTools(server)
registerExpressionTools(server)
registerLifecycleTools(server)
registerHistoryTools(server)
registerLearningTools(server)
registerAdminTools(server)

const transport = new StdioServerTransport()
await server.connect(transport)
