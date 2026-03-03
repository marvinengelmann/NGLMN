import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { migrate } from "drizzle-orm/neon-http/migrator"
import { env } from "@/config/env.ts"
import { ensureSeeded } from "@/db/seed.ts"
import { redis } from "@/integrations/redis.ts"
import { setupSentry } from "@/lib/sentry.ts"

const INIT_KEY = "working:init:complete"

/**
 * Runs database migrations, seeding, and Sentry initialization if not already done.
 * Idempotent — uses a Redis flag to skip on subsequent worker starts.
 */
export async function runInit(): Promise<void> {
  setupSentry()

  const done = await redis.get(INIT_KEY)
  if (done) return

  const migrationDb = drizzle({ client: neon(env().DATABASE_URL) })
  await migrate(migrationDb, { migrationsFolder: "./drizzle" })
  await ensureSeeded()
  await redis.set(INIT_KEY, "true")
}
