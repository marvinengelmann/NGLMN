import type { AnyPgColumn } from "drizzle-orm/pg-core"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  unique,
  uuid
} from "drizzle-orm/pg-core"

export const entityTypeEnum = pgEnum("entity_type", ["person", "place", "organization", "event", "concept", "object"])

export const episodeLinkTypeEnum = pgEnum("episode_link_type", [
  "caused",
  "resolved_by",
  "reminded_of",
  "contradicts",
  "continues"
])

export const semanticCategoryEnum = pgEnum("semantic_category", [
  "preference",
  "project",
  "contact",
  "knowledge",
  "insight"
])
export const semanticSourceEnum = pgEnum("semantic_source", ["operator", "observation", "dream", "reflection"])
export const semanticScopeEnum = pgEnum("semantic_scope", ["self", "operator", "world"])

export const tickLog = pgTable(
  "tick_log",
  {
    id: serial("id").primaryKey(),
    tickId: text("tick_id").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    action: text("action").notNull(),
    reasoning: text("reasoning").notNull(),
    messagesProcessed: integer("messages_processed").notNull().default(0),
    responseSent: boolean("response_sent").notNull().default(false),
    responseText: text("response_text"),
    durationMs: integer("duration_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_tick_log_timestamp").on(table.timestamp),
    index("idx_tick_log_tick_id").on(table.tickId),
    index("idx_tick_log_created_at").on(table.createdAt)
  ]
)

export type TickLogInsert = typeof tickLog.$inferInsert
export type TickLogSelect = typeof tickLog.$inferSelect

export const semanticMemory = pgTable(
  "semantic_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: semanticCategoryEnum("category").notNull(),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    confidence: real("confidence").default(0.5),
    source: semanticSourceEnum("source").notNull(),
    scope: semanticScopeEnum("scope").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true })
  },
  (table) => [
    unique("uq_semantic_memory_category_key_scope").on(table.category, table.key, table.scope),
    index("idx_semantic_memory_category_key").on(table.category, table.key),
    index("idx_semantic_memory_scope").on(table.scope),
    index("idx_semantic_memory_updated_at").on(table.updatedAt)
  ]
)

export type SemanticMemoryInsert = typeof semanticMemory.$inferInsert
export type SemanticMemorySelect = typeof semanticMemory.$inferSelect

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    source: text("source").notNull(),
    priority: real("priority").default(0.5),
    status: text("status").default("open"),
    emotionalWeight: real("emotional_weight").default(0.5),
    parentGoalId: uuid("parent_goal_id").references((): AnyPgColumn => goals.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    deadline: timestamp("deadline", { withTimezone: true })
  },
  (table) => [
    index("idx_goals_status").on(table.status),
    index("idx_goals_parent").on(table.parentGoalId),
    index("idx_goals_status_created").on(table.status, table.createdAt),
    index("idx_goals_title").on(table.title)
  ]
)

export type GoalInsert = typeof goals.$inferInsert
export type GoalSelect = typeof goals.$inferSelect

export const emotionHistory = pgTable(
  "emotion_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    state: jsonb("state").notNull(),
    trigger: text("trigger"),
    tickId: text("tick_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_emotion_history_trigger").on(table.trigger),
    index("idx_emotion_history_tick_id").on(table.tickId),
    index("idx_emotion_history_created").on(table.createdAt)
  ]
)

export type EmotionHistoryInsert = typeof emotionHistory.$inferInsert
export type EmotionHistorySelect = typeof emotionHistory.$inferSelect

export const evolutionLog = pgTable(
  "evolution_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    description: text("description").notNull(),
    narrative: text("narrative"),
    outcome: text("outcome"),
    diff: text("diff"),
    snapshotRef: text("snapshot_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_evolution_log_created_at").on(table.createdAt),
    index("idx_evolution_log_type_created").on(table.type, table.createdAt),
    index("idx_evolution_log_outcome_created").on(table.outcome, table.createdAt)
  ]
)

export type EvolutionLogInsert = typeof evolutionLog.$inferInsert
export type EvolutionLogSelect = typeof evolutionLog.$inferSelect

export const promptVersions = pgTable("prompt_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  promptId: text("prompt_id").notNull(),
  version: integer("version").notNull(),
  content: text("content").notNull(),
  changelog: text("changelog"),
  metricsAtCreation: jsonb("metrics_at_creation"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
})

export type PromptVersionInsert = typeof promptVersions.$inferInsert
export type PromptVersionSelect = typeof promptVersions.$inferSelect

export const routineLog = pgTable("routine_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  phase: text("phase").notNull(),
  summary: text("summary").notNull(),
  insights: jsonb("insights"),
  metricsSnapshot: jsonb("metrics_snapshot"),
  emotionBefore: jsonb("emotion_before"),
  emotionAfter: jsonb("emotion_after"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
})

export type RoutineLogInsert = typeof routineLog.$inferInsert
export type RoutineLogSelect = typeof routineLog.$inferSelect

export const workflows = pgTable(
  "workflows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    trigger: jsonb("trigger").notNull(),
    instruction: text("instruction").notNull(),
    outputAction: text("output_action").notNull(),
    enabled: boolean("enabled").default(false),
    createdBy: text("created_by").notNull(),
    executionCount: integer("execution_count").default(0),
    lastExecutedAt: timestamp("last_executed_at", { withTimezone: true }),
    version: integer("version").default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_workflows_enabled").on(table.enabled)]
)

export type WorkflowInsert = typeof workflows.$inferInsert
export type WorkflowSelect = typeof workflows.$inferSelect

export const semanticRelations = pgTable(
  "semantic_relations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => semanticMemory.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => semanticMemory.id, { onDelete: "cascade" }),
    relationType: text("relation_type").notNull(),
    strength: real("strength").default(0.5),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_semantic_relations_source").on(table.sourceId),
    index("idx_semantic_relations_target").on(table.targetId)
  ]
)

export type SemanticRelationInsert = typeof semanticRelations.$inferInsert
export type SemanticRelationSelect = typeof semanticRelations.$inferSelect

export const somaticHistory = pgTable(
  "somatic_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    state: jsonb("state").notNull(),
    trigger: text("trigger").notNull(),
    tickId: text("tick_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_somatic_history_created").on(table.createdAt)]
)

export type SomaticHistoryInsert = typeof somaticHistory.$inferInsert
export type SomaticHistorySelect = typeof somaticHistory.$inferSelect

export const psycheSnapshots = pgTable(
  "psyche_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    selfConcept: jsonb("self_concept").notNull(),
    aspirations: jsonb("aspirations"),
    fears: jsonb("fears"),
    narrativeSummary: text("narrative_summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_psyche_snapshots_created").on(table.createdAt)]
)

export type PsycheSnapshotInsert = typeof psycheSnapshots.$inferInsert
export type PsycheSnapshotSelect = typeof psycheSnapshots.$inferSelect

export const narrativeEntries = pgTable(
  "narrative_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    content: text("content").notNull(),
    emotionalColoring: text("emotional_coloring").notNull(),
    significance: real("significance").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_narrative_entries_created").on(table.createdAt)]
)

export type NarrativeEntryInsert = typeof narrativeEntries.$inferInsert
export type NarrativeEntrySelect = typeof narrativeEntries.$inferSelect

export const attachmentLog = pgTable(
  "attachment_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    style: jsonb("style").notNull(),
    dynamics: jsonb("dynamics").notNull(),
    trigger: text("trigger").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_attachment_log_created").on(table.createdAt)]
)

export type AttachmentLogInsert = typeof attachmentLog.$inferInsert
export type AttachmentLogSelect = typeof attachmentLog.$inferSelect

export const dissonanceLog = pgTable(
  "dissonance_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    declaredValue: text("declared_value").notNull(),
    actualAction: text("actual_action").notNull(),
    dissonanceScore: real("dissonance_score").notNull(),
    resolution: text("resolution"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_dissonance_log_created").on(table.createdAt)]
)

export type DissonanceLogInsert = typeof dissonanceLog.$inferInsert
export type DissonanceLogSelect = typeof dissonanceLog.$inferSelect

export const relationshipPhaseLog = pgTable(
  "relationship_phase_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phase: text("phase").notNull(),
    previousPhase: text("previous_phase"),
    trigger: text("trigger").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_relationship_phase_log_created").on(table.createdAt)]
)

export type RelationshipPhaseLogInsert = typeof relationshipPhaseLog.$inferInsert
export type RelationshipPhaseLogSelect = typeof relationshipPhaseLog.$inferSelect

export const operatorModelLog = pgTable(
  "operator_model_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    model: jsonb("model"),
    trigger: text("trigger").notNull(),
    correction: jsonb("correction"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_operator_model_log_created").on(table.createdAt)]
)

export type OperatorModelLogInsert = typeof operatorModelLog.$inferInsert
export type OperatorModelLogSelect = typeof operatorModelLog.$inferSelect

export const distortionLog = pgTable(
  "distortion_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    originalEpisodeId: text("original_episode_id").notNull(),
    alteredField: text("altered_field").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_distortion_log_created").on(table.createdAt)]
)

export type DistortionLogInsert = typeof distortionLog.$inferInsert
export type DistortionLogSelect = typeof distortionLog.$inferSelect

export const heldBackLog = pgTable(
  "held_back_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    content: text("content").notNull(),
    reason: text("reason").notNull(),
    emotionalCharge: real("emotional_charge").notNull(),
    surfaced: boolean("surfaced").default(false),
    surfacedAt: timestamp("surfaced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_held_back_log_created").on(table.createdAt)]
)

export type HeldBackLogInsert = typeof heldBackLog.$inferInsert
export type HeldBackLogSelect = typeof heldBackLog.$inferSelect

export const deceptionLog = pgTable(
  "deception_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actualDriver: text("actual_driver").notNull(),
    statedReason: text("stated_reason").notNull(),
    hiddenSince: timestamp("hidden_since", { withTimezone: true }).notNull(),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_deception_log_created").on(table.createdAt)]
)

export const habitLog = pgTable(
  "habit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    habitId: text("habit_id").notNull(),
    pattern: text("pattern").notNull(),
    type: text("type").notNull(),
    strength: real("strength").notNull(),
    event: text("event").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_habit_log_created").on(table.createdAt)]
)

export type HabitLogInsert = typeof habitLog.$inferInsert
export type HabitLogSelect = typeof habitLog.$inferSelect

export const coherenceLog = pgTable(
  "coherence_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    integrationScore: real("integration_score").notNull(),
    fragmentationSources: jsonb("fragmentation_sources").notNull(),
    regressionActive: boolean("regression_active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_coherence_log_created").on(table.createdAt)]
)

export type CoherenceLogInsert = typeof coherenceLog.$inferInsert
export type CoherenceLogSelect = typeof coherenceLog.$inferSelect

export const boundaryLog = pgTable(
  "boundary_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boundaryId: text("boundary_id").notNull(),
    event: text("event").notNull(),
    strength: real("strength").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_boundary_log_created").on(table.createdAt)]
)

export type BoundaryLogInsert = typeof boundaryLog.$inferInsert
export type BoundaryLogSelect = typeof boundaryLog.$inferSelect

export const interactionOutcomes = pgTable(
  "interaction_outcomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tickId: text("tick_id").notNull(),
    conversationId: text("conversation_id"),
    strategy: jsonb("strategy").notNull(),
    responseText: text("response_text"),
    operatorReaction: jsonb("operator_reaction"),
    outcomeScore: real("outcome_score"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true })
  },
  (table) => [
    index("idx_interaction_outcomes_tick_id").on(table.tickId),
    index("idx_interaction_outcomes_created_at").on(table.createdAt),
    index("idx_interaction_outcomes_resolved_at").on(table.resolvedAt)
  ]
)

export type InteractionOutcomeInsert = typeof interactionOutcomes.$inferInsert
export type InteractionOutcomeSelect = typeof interactionOutcomes.$inferSelect

export const genesis = pgTable("genesis", {
  id: uuid("id").primaryKey().defaultRandom(),
  seed: text("seed").notNull(),
  dna: jsonb("dna").notNull(),
  identity: jsonb("identity").notNull(),
  voiceId: text("voice_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
})

export type GenesisInsert = typeof genesis.$inferInsert
export type GenesisSelect = typeof genesis.$inferSelect

export const conversationArcs = pgTable(
  "conversation_arcs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: text("conversation_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
    themes: jsonb("themes").notNull(),
    tone: text("tone").notNull(),
    emotionalArc: jsonb("emotional_arc").notNull(),
    operatorEngagement: real("operator_engagement").notNull(),
    unresolvedTopics: jsonb("unresolved_topics").notNull(),
    significantMoments: jsonb("significant_moments").notNull(),
    messageCount: integer("message_count").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_conversation_arcs_created_at").on(table.createdAt),
    index("idx_conversation_arcs_conversation_id").on(table.conversationId)
  ]
)

export type ConversationArcInsert = typeof conversationArcs.$inferInsert
export type ConversationArcSelect = typeof conversationArcs.$inferSelect

export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    insight: text("insight").notNull(),
    context: jsonb("context").notNull(),
    confidence: real("confidence").notNull().default(0.5),
    source: text("source").notNull().default("interaction"),
    reinforcementCount: integer("reinforcement_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_lessons_confidence").on(table.confidence), index("idx_lessons_source").on(table.source)]
)

export type LessonInsert = typeof lessons.$inferInsert
export type LessonSelect = typeof lessons.$inferSelect

export const entities = pgTable(
  "entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    type: entityTypeEnum("type").notNull(),
    attributes: jsonb("attributes").notNull().default({}),
    firstMentionedAt: timestamp("first_mentioned_at", { withTimezone: true }).notNull().defaultNow(),
    lastMentionedAt: timestamp("last_mentioned_at", { withTimezone: true }).notNull().defaultNow(),
    salience: real("salience").notNull().default(0.5),
    mentionCount: integer("mention_count").notNull().default(1),
    source: semanticSourceEnum("source").notNull()
  },
  (table) => [
    index("idx_entities_name").on(table.name),
    index("idx_entities_type").on(table.type),
    index("idx_entities_salience").on(table.salience),
    index("idx_entities_last_mentioned").on(table.lastMentionedAt)
  ]
)

export type EntityInsert = typeof entities.$inferInsert
export type EntitySelect = typeof entities.$inferSelect

export const entityRelations = pgTable(
  "entity_relations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceEntityId: uuid("source_entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    targetEntityId: uuid("target_entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    relationType: text("relation_type").notNull(),
    strength: real("strength").notNull().default(0.5),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    source: semanticSourceEnum("source").notNull(),
    episodeId: text("episode_id"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_entity_relations_source").on(table.sourceEntityId),
    index("idx_entity_relations_target").on(table.targetEntityId),
    index("idx_entity_relations_type").on(table.relationType)
  ]
)

export type EntityRelationInsert = typeof entityRelations.$inferInsert
export type EntityRelationSelect = typeof entityRelations.$inferSelect

export const entityMentions = pgTable(
  "entity_mentions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    tickId: text("tick_id").notNull(),
    context: text("context").notNull(),
    sentiment: real("sentiment").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_entity_mentions_entity").on(table.entityId),
    index("idx_entity_mentions_tick").on(table.tickId)
  ]
)

export type EntityMentionInsert = typeof entityMentions.$inferInsert
export type EntityMentionSelect = typeof entityMentions.$inferSelect

export const procedures = pgTable(
  "procedures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trigger: jsonb("trigger").notNull(),
    strategy: text("strategy").notNull(),
    successRate: real("success_rate").notNull().default(0.5),
    timesApplied: integer("times_applied").notNull().default(0),
    timesSucceeded: integer("times_succeeded").notNull().default(0),
    lastAppliedAt: timestamp("last_applied_at", { withTimezone: true }),
    emotionalContext: text("emotional_context"),
    source: text("source").notNull().default("interaction"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_procedures_success_rate").on(table.successRate),
    index("idx_procedures_created_at").on(table.createdAt)
  ]
)

export type ProcedureInsert = typeof procedures.$inferInsert
export type ProcedureSelect = typeof procedures.$inferSelect

export const episodeLinks = pgTable(
  "episode_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceEpisodeId: text("source_episode_id").notNull(),
    targetEpisodeId: text("target_episode_id").notNull(),
    linkType: episodeLinkTypeEnum("link_type").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_episode_links_source").on(table.sourceEpisodeId),
    index("idx_episode_links_target").on(table.targetEpisodeId)
  ]
)

export type EpisodeLinkInsert = typeof episodeLinks.$inferInsert
export type EpisodeLinkSelect = typeof episodeLinks.$inferSelect
