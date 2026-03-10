CREATE TABLE "boundary_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"boundary_id" text NOT NULL,
	"event" text NOT NULL,
	"strength" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coherence_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_score" real NOT NULL,
	"fragmentation_sources" jsonb NOT NULL,
	"regression_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"habit_id" text NOT NULL,
	"pattern" text NOT NULL,
	"type" text NOT NULL,
	"strength" real NOT NULL,
	"event" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_boundary_log_created" ON "boundary_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_coherence_log_created" ON "coherence_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_habit_log_created" ON "habit_log" USING btree ("created_at");