CREATE TYPE "public"."semantic_category" AS ENUM('preference', 'project', 'contact', 'knowledge', 'insight');--> statement-breakpoint
CREATE TYPE "public"."semantic_scope" AS ENUM('self', 'operator', 'world');--> statement-breakpoint
CREATE TYPE "public"."semantic_source" AS ENUM('operator', 'observation', 'dream', 'reflection');--> statement-breakpoint
CREATE TABLE "dream_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phase" text NOT NULL,
	"summary" text NOT NULL,
	"insights" jsonb,
	"metrics_snapshot" jsonb,
	"emotion_before" jsonb,
	"emotion_after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emotion_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" jsonb NOT NULL,
	"trigger" text,
	"tick_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evolution_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"narrative" text,
	"outcome" text,
	"diff" text,
	"snapshot_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"source" text NOT NULL,
	"priority" real DEFAULT 0.5,
	"status" text DEFAULT 'open',
	"emotional_weight" real DEFAULT 0.5,
	"parent_goal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"deadline" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "prompt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt_id" text NOT NULL,
	"version" integer NOT NULL,
	"content" text NOT NULL,
	"changelog" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "semantic_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "semantic_category" NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"confidence" real DEFAULT 0.5,
	"source" "semantic_source" NOT NULL,
	"scope" "semantic_scope" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_accessed_at" timestamp with time zone,
	CONSTRAINT "uq_semantic_memory_category_key_scope" UNIQUE("category","key","scope")
);
--> statement-breakpoint
CREATE TABLE "semantic_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"relation_type" text NOT NULL,
	"strength" real DEFAULT 0.5,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tick_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"tick_id" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"action" text NOT NULL,
	"reasoning" text NOT NULL,
	"messages_processed" integer DEFAULT 0 NOT NULL,
	"response_sent" boolean DEFAULT false NOT NULL,
	"response_text" text,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trust_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_type" text NOT NULL,
	"fear" real DEFAULT 0.8,
	"confidence" real DEFAULT 0.1,
	"total_attempts" integer DEFAULT 0,
	"successful_attempts" integer DEFAULT 0,
	"last_attempt_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"trigger" jsonb NOT NULL,
	"instruction" text NOT NULL,
	"output_action" text NOT NULL,
	"enabled" boolean DEFAULT false,
	"created_by" text NOT NULL,
	"execution_count" integer DEFAULT 0,
	"last_executed_at" timestamp with time zone,
	"version" integer DEFAULT 1,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_parent_goal_id_goals_id_fk" FOREIGN KEY ("parent_goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semantic_relations" ADD CONSTRAINT "semantic_relations_source_id_semantic_memory_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."semantic_memory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semantic_relations" ADD CONSTRAINT "semantic_relations_target_id_semantic_memory_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."semantic_memory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_emotion_history_trigger" ON "emotion_history" USING btree ("trigger");--> statement-breakpoint
CREATE INDEX "idx_emotion_history_tick_id" ON "emotion_history" USING btree ("tick_id");--> statement-breakpoint
CREATE INDEX "idx_emotion_history_created" ON "emotion_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_goals_status" ON "goals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_goals_parent" ON "goals" USING btree ("parent_goal_id");--> statement-breakpoint
CREATE INDEX "idx_goals_status_created" ON "goals" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_semantic_memory_category_key" ON "semantic_memory" USING btree ("category","key");--> statement-breakpoint
CREATE INDEX "idx_semantic_memory_scope" ON "semantic_memory" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "idx_semantic_relations_source" ON "semantic_relations" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_semantic_relations_target" ON "semantic_relations" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "idx_tick_log_timestamp" ON "tick_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_tick_log_tick_id" ON "tick_log" USING btree ("tick_id");--> statement-breakpoint
CREATE INDEX "idx_workflows_enabled" ON "workflows" USING btree ("enabled");