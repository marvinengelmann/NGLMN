CREATE TABLE "defense_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"trigger" text NOT NULL,
	"intensity" real NOT NULL,
	"breakthrough" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hebbian_associations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stimulus_a" text NOT NULL,
	"stimulus_b" text NOT NULL,
	"strength" real DEFAULT 0.1 NOT NULL,
	"coactivation_count" integer DEFAULT 1 NOT NULL,
	"last_coactivated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "neuromodulatory_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" jsonb NOT NULL,
	"trigger" text NOT NULL,
	"tick_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_defense_log_created" ON "defense_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_hebbian_pair" ON "hebbian_associations" USING btree ("stimulus_a","stimulus_b");--> statement-breakpoint
CREATE INDEX "idx_hebbian_stimulus_a" ON "hebbian_associations" USING btree ("stimulus_a");--> statement-breakpoint
CREATE INDEX "idx_hebbian_strength" ON "hebbian_associations" USING btree ("strength");--> statement-breakpoint
CREATE INDEX "idx_neuromodulatory_history_created" ON "neuromodulatory_history" USING btree ("created_at");