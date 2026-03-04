CREATE TABLE "deception_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actual_driver" text NOT NULL,
	"stated_reason" text NOT NULL,
	"hidden_since" timestamp with time zone NOT NULL,
	"discovered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "distortion_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"original_episode_id" text NOT NULL,
	"altered_field" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operator_model_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model" jsonb,
	"trigger" text NOT NULL,
	"correction" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relationship_phase_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phase" text NOT NULL,
	"previous_phase" text,
	"trigger" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_deception_log_created" ON "deception_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_distortion_log_created" ON "distortion_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_operator_model_log_created" ON "operator_model_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_relationship_phase_log_created" ON "relationship_phase_log" USING btree ("created_at");