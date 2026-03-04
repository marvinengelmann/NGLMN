CREATE TABLE "attachment_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"style" jsonb NOT NULL,
	"dynamics" jsonb NOT NULL,
	"trigger" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dissonance_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"declared_value" text NOT NULL,
	"actual_action" text NOT NULL,
	"dissonance_score" real NOT NULL,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "narrative_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"emotional_coloring" text NOT NULL,
	"significance" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "psyche_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"self_concept" jsonb NOT NULL,
	"aspirations" jsonb,
	"fears" jsonb,
	"narrative_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "somatic_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" jsonb NOT NULL,
	"trigger" text NOT NULL,
	"tick_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_attachment_log_created" ON "attachment_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_dissonance_log_created" ON "dissonance_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_narrative_entries_created" ON "narrative_entries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_psyche_snapshots_created" ON "psyche_snapshots" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_somatic_history_created" ON "somatic_history" USING btree ("created_at");