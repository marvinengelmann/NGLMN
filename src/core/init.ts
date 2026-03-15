import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { migrate } from "drizzle-orm/neon-http/migrator"
import { env, validateEnv } from "@/infra/config/env.ts"
import { setupSentry } from "@/infra/lib/sentry.ts"
import { runGenesis } from "@/self/genesis/genesis.ts"

/**
 * Runs database migrations, Sentry initialization, and genesis (if first run).
 * All operations are idempotent — safe to run on every start.
 */
export async function runInit(): Promise<void> {
  validateEnv()
  setupSentry()

  const migrationDb = drizzle({ client: neon(env().DATABASE_URL) })
  await migrate(migrationDb, { migrationsFolder: "./drizzle" })

  await runGenesis()
}
