import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"
import { env } from "@/config/env"

const envFile = process.argv.includes("--prod") ? ".env.production" : ".env.local"
config({ path: envFile, override: true })

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: env().DATABASE_URL
  }
})
