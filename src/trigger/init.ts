import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { migrate } from "drizzle-orm/neon-http/migrator"
import { env } from "@/config/env.ts"
import { setupSentry } from "@/config/setup-sentry"
import { ensureSeeded } from "@/db/seed.ts"
import { redis } from "@/integrations/redis.ts"

setupSentry()

const INIT_KEY = "working:init:complete"

const done = await redis.get(INIT_KEY)

if (!done) {
  const migrationDb = drizzle({ client: neon(env().DATABASE_URL) })
  await migrate(migrationDb, { migrationsFolder: "./drizzle" })
  await ensureSeeded()
  await redis.set(INIT_KEY, "true")
}
