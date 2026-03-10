import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"
import { env } from "@/infra/config/env"

const envFile = process.argv.includes("--prod") ? ".env.production" : ".env.local"
config({ path: envFile, override: true })

export default defineConfig({
  schema: "./src/infra/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: env().DATABASE_URL
  }
})
