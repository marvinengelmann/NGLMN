CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insight" text NOT NULL,
	"context" jsonb NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"source" text DEFAULT 'interaction' NOT NULL,
	"reinforcement_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD COLUMN "metrics_at_creation" jsonb;--> statement-breakpoint
CREATE INDEX "idx_lessons_confidence" ON "lessons" USING btree ("confidence");--> statement-breakpoint
CREATE INDEX "idx_lessons_source" ON "lessons" USING btree ("source");