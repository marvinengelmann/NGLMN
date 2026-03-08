import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { migrate } from "drizzle-orm/neon-http/migrator"
import { env } from "@/config/env.ts"
import { runGenesis } from "@/genesis/genesis.ts"
import { setupSentry } from "@/lib/sentry.ts"

/**
 * Runs database migrations, Sentry initialization, and genesis (if first run).
 * All operations are idempotent — safe to run on every start.
 */
export async function runInit(): Promise<void> {
  setupSentry()

  const migrationDb = drizzle({ client: neon(env().DATABASE_URL) })
  await migrate(migrationDb, { migrationsFolder: "./drizzle" })

  await runGenesis()
}
