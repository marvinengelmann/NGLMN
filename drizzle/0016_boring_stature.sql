CREATE TYPE "public"."visual_reference_category" AS ENUM('portrait', 'full_body', 'bedroom', 'living_room', 'kitchen', 'bathroom', 'balcony', 'desk', 'workspace', 'casual_outfit', 'formal_outfit', 'sleepwear', 'workout_outfit', 'favorite_cafe', 'neighborhood', 'park', 'pet', 'night_aesthetic', 'rainy_mood', 'cozy_vibe');--> statement-breakpoint
CREATE TABLE "visual_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "visual_reference_category" NOT NULL,
	"blob_url" text NOT NULL,
	"prompt_used" text NOT NULL,
	"generation_cost" real NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_visual_reference_active_category" ON "visual_references" USING btree ("category") WHERE "visual_references"."active" = true;--> statement-breakpoint
CREATE INDEX "idx_visual_references_category" ON "visual_references" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_visual_references_active" ON "visual_references" USING btree ("active");