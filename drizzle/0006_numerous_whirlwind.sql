CREATE TABLE "held_back_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"reason" text NOT NULL,
	"emotional_charge" real NOT NULL,
	"surfaced" boolean DEFAULT false,
	"surfaced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_held_back_log_created" ON "held_back_log" USING btree ("created_at");