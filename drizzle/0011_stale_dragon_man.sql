CREATE TABLE "conversation_arcs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"themes" jsonb NOT NULL,
	"tone" text NOT NULL,
	"emotional_arc" jsonb NOT NULL,
	"operator_engagement" real NOT NULL,
	"unresolved_topics" jsonb NOT NULL,
	"significant_moments" jsonb NOT NULL,
	"message_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_conversation_arcs_created_at" ON "conversation_arcs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_conversation_arcs_conversation_id" ON "conversation_arcs" USING btree ("conversation_id");