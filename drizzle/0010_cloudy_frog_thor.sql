CREATE TABLE "interaction_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tick_id" text NOT NULL,
	"conversation_id" text,
	"strategy" jsonb NOT NULL,
	"response_text" text,
	"operator_reaction" jsonb,
	"outcome_score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "idx_interaction_outcomes_tick_id" ON "interaction_outcomes" USING btree ("tick_id");--> statement-breakpoint
CREATE INDEX "idx_interaction_outcomes_created_at" ON "interaction_outcomes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_interaction_outcomes_resolved_at" ON "interaction_outcomes" USING btree ("resolved_at");