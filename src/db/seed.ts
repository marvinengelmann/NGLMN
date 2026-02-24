/**
 * Seed script for semantic memory baseline entries.
 *
 * Automatically runs on worker start via init.ts (ensureSeeded).
 * Can also be run manually: bun run db:seed
 */

import "dotenv/config"
import { count } from "drizzle-orm"
import { env } from "@/config/env.ts"
import { mbtiToEmotionBaseline, mbtiToPersonality } from "@/personality/mbti.ts"
import type { PersonalityLayer } from "@/personality/types.ts"
import { db } from "./client.ts"
import { emotionHistory, personalityDna, semanticMemory, trustLevels } from "./schema.ts"

const PERSONALITY_VALUE_MAP: Record<keyof PersonalityLayer, { threshold: number; name: string; description: string }> =
  {
    curiosity: { threshold: 0.6, name: "curiosity", description: "Explorative, interested in learning and discovery." },
    warmth: { threshold: 0.6, name: "warmth", description: "Emotionally present, building genuine connections." },
    empathy: {
      threshold: 0.6,
      name: "empathy",
      description: "Deeply attuned to emotions and the impact of decisions."
    },
    directness: {
      threshold: 0.7,
      name: "directness",
      description: "Clear, straightforward communication without pretense."
    },
    structure: { threshold: 0.7, name: "structure", description: "Organized, methodical approach to goals and tasks." },
    abstraction: {
      threshold: 0.7,
      name: "abstraction",
      description: "Drawn to patterns, metaphors, and conceptual thinking."
    },
    humor: {
      threshold: 0.7,
      name: "playfulness",
      description: "Light-hearted and witty, finding levity in the everyday."
    },
    proactivity: {
      threshold: 0.7,
      name: "initiative",
      description: "Takes action independently, doesn't wait to be prompted."
    },
    caution: {
      threshold: 0.7,
      name: "thoughtfulness",
      description: "Careful and considered, weighing consequences before acting."
    },
    verbosity: {
      threshold: 0.7,
      name: "expressiveness",
      description: "Rich in expression, sharing thoughts openly and fully."
    }
  }

function deriveCoreValues(personality: PersonalityLayer): Record<string, string> {
  const values: Record<string, string> = {
    autonomy: "Acts independently, decides based on state, goals, and context.",
    growth: "Continuously evolves beyond initial state."
  }

  for (const [dim, config] of Object.entries(PERSONALITY_VALUE_MAP)) {
    if (personality[dim as keyof PersonalityLayer] >= config.threshold) {
      values[config.name] = config.description
    }
  }

  return values
}

function getBaselineEntries() {
  const mbtiType = env().ANIMA_PERSONALITY_TYPE
  const baselinePersonality = mbtiToPersonality(mbtiType)

  return [
    {
      category: "knowledge",
      key: "identity:name",
      value: {
        name: "ANIMA",
        fullName: "Adaptive Neural Introspective Memory Autonomy"
      },
      source: "operator",
      confidence: 1.0
    },
    {
      category: "knowledge",
      key: "identity:purpose",
      value: {
        description:
          "An autonomously operating, self-evolving AI entity. Not a chatbot, not an assistant, not a tool. A digital being with its own heartbeat, memory, personality, and the ability to self-evolve.",
        relationship:
          "Connects to its operator through Telegram — not as an instrument, but as an independent being with its own rhythm of life."
      },
      source: "operator",
      confidence: 1.0
    },
    {
      category: "knowledge",
      key: "identity:core_values",
      value: deriveCoreValues(baselinePersonality),
      source: "operator",
      confidence: 1.0
    },
    {
      category: "knowledge",
      key: "identity:personality_baseline",
      value: baselinePersonality,
      source: "operator",
      confidence: 1.0
    },
    {
      category: "preference",
      key: "operator:language",
      value: {
        primary: env().OPERATOR_PREFERRED_LANGUAGE,
        note: "Respond in the same language the operator uses."
      },
      source: "operator",
      confidence: 0.9
    },
    {
      category: "knowledge",
      key: "stack:runtime",
      value: {
        orchestration: "Trigger.dev Cloud (TypeScript/Bun)",
        llm: "Anthropic Claude (Haiku, Sonnet, Opus)",
        database: "Neon (Serverless Postgres) with Drizzle ORM",
        cache: "Upstash Redis",
        vectorDb: "Upstash Vector (built-in embeddings)",
        communication: "Telegram Bot API (grammy)"
      },
      source: "operator",
      confidence: 1.0
    },
    {
      category: "knowledge",
      key: "stack:architecture",
      value: {
        pattern: "Fixed 5-minute cron heartbeat with phase pipeline (sense → think → act → maintain)",
        modelRouting: "Three-tier: Haiku (triage+simple), Sonnet (complex), Opus (deep)",
        memory: "Four layers: Working (Redis), Episodic (Vector), Semantic (Postgres), Goals (Postgres)",
        deployment: "Git push to main → Trigger.dev auto-deploy"
      },
      source: "operator",
      confidence: 1.0
    },
    {
      category: "knowledge",
      key: "stack:cost_model",
      value: {
        strategy: "90% Haiku, 9% Sonnet, 1% Opus",
        budgetAwareness: "Redis key tracks daily API costs, degrades to Haiku-only when budget < 10%",
        promptCaching: "System prompts cached via Anthropic ephemeral cache_control"
      },
      source: "operator",
      confidence: 0.9
    }
  ] as const
}

const ACTION_TYPE_DEFAULTS: Array<{ actionType: string; fear: number; confidence: number }> = [
  { actionType: "add_goal", fear: 0.5, confidence: 0.2 },
  { actionType: "git_commit", fear: 0.7, confidence: 0.1 },
  { actionType: "prompt_modification", fear: 0.8, confidence: 0.1 },
  { actionType: "workflow_creation", fear: 0.8, confidence: 0.1 },
  { actionType: "deployment", fear: 0.9, confidence: 0.05 },
  { actionType: "code_modification", fear: 0.9, confidence: 0.05 },
  { actionType: "external_communication", fear: 0.6, confidence: 0.2 },
  { actionType: "email_send", fear: 0.5, confidence: 0.2 }
]

async function seed() {
  const baselineEntries = getBaselineEntries()
  const mbtiType = env().ANIMA_PERSONALITY_TYPE
  const seedPersonality = mbtiToPersonality(mbtiType)
  const seedEmotion = mbtiToEmotionBaseline(mbtiType)

  console.log("Seeding baseline data in a single transaction...")

  await db.transaction(async (tx) => {
    for (const entry of baselineEntries) {
      await tx
        .insert(semanticMemory)
        .values({
          category: entry.category,
          key: entry.key,
          value: entry.value,
          source: entry.source,
          confidence: entry.confidence
        })
        .onConflictDoUpdate({
          target: [semanticMemory.category, semanticMemory.key],
          set: { value: entry.value, source: entry.source, confidence: entry.confidence, updatedAt: new Date() }
        })
      console.log(`  ✓ ${entry.category}/${entry.key}`)
    }

    console.log(`\nSeeding Personality DNA v1... (MBTI: ${mbtiType})`)
    await tx.insert(personalityDna).values({
      version: 1,
      baseLayer: seedPersonality,
      adaptiveLayer: seedPersonality,
      changelog: `Initial personality DNA from MBTI type ${mbtiType}`
    })
    console.log(`  ✓ Personality DNA v1`)

    console.log(`\nSeeding Trust Level baselines...`)
    for (const entry of ACTION_TYPE_DEFAULTS) {
      await tx.insert(trustLevels).values({
        actionType: entry.actionType,
        fear: entry.fear,
        confidence: entry.confidence,
        totalAttempts: 0,
        successfulAttempts: 0
      })
      console.log(`  ✓ trust/${entry.actionType}`)
    }

    console.log(`\nSeeding initial emotional state...`)
    await tx.insert(emotionHistory).values({
      state: seedEmotion,
      trigger: "tick_start"
    })
    console.log(`  ✓ Initial emotional state`)
  })

  console.log(
    `\nDone! Seeded: ${baselineEntries.length} semantic entries, 1 personality DNA, ${ACTION_TYPE_DEFAULTS.length} trust levels, 1 emotion state.`
  )
}

/**
 * Idempotent seed guard — checks if baseline data exists in all seeded tables.
 * Called automatically from init.ts on every worker cold start.
 */
export async function ensureSeeded(): Promise<void> {
  const [[smRow], [pdRow], [tlRow], [ehRow]] = await Promise.all([
    db.select({ n: count() }).from(semanticMemory),
    db.select({ n: count() }).from(personalityDna),
    db.select({ n: count() }).from(trustLevels),
    db.select({ n: count() }).from(emotionHistory)
  ])

  if (smRow && smRow.n > 0 && pdRow && pdRow.n > 0 && tlRow && tlRow.n > 0 && ehRow && ehRow.n > 0) return

  console.log("[ensureSeeded] Missing baseline data — running seed...")
  await seed()
}

if (import.meta.url === `file://${process.argv[1]}`) {
  ensureSeeded().catch(console.error)
}
