import { desc, eq } from "drizzle-orm"
import { db } from "@/db/client.ts"
import { promptVersions } from "@/db/schema.ts"

/**
 * Load the latest version of a prompt from DB, falling back to the hardcoded constant.
 */
export async function loadPrompt(promptId: string, fallback: string): Promise<string> {
  const rows = await db
    .select({ content: promptVersions.content })
    .from(promptVersions)
    .where(eq(promptVersions.promptId, promptId))
    .orderBy(desc(promptVersions.version))
    .limit(1)

  if (rows.length > 0 && rows[0]?.content) {
    return rows[0].content
  }

  return fallback
}
