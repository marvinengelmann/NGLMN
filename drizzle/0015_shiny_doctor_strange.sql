CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"detail" text,
	"metadata" jsonb,
	"tick_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_events_type" ON "events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_events_created" ON "events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_events_tick_id" ON "events" USING btree ("tick_id");