CREATE TABLE "dissociation_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"depth" real NOT NULL,
	"symptoms" jsonb NOT NULL,
	"trigger_source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forecast_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger_event" text NOT NULL,
	"predicted_intensity" real NOT NULL,
	"actual_intensity" real,
	"predicted_duration" integer NOT NULL,
	"actual_duration" integer,
	"biases_applied" jsonb NOT NULL,
	"intensity_error" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pattern_activation_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" text NOT NULL,
	"trigger_context" text NOT NULL,
	"match_confidence" real NOT NULL,
	"awareness_level" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_dissociation_log_created" ON "dissociation_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_forecast_log_created" ON "forecast_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_pattern_activation_log_created" ON "pattern_activation_log" USING btree ("created_at");