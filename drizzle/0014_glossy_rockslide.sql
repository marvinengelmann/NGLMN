CREATE TYPE "public"."entity_type" AS ENUM('person', 'place', 'organization', 'event', 'concept', 'object');--> statement-breakpoint
CREATE TYPE "public"."episode_link_type" AS ENUM('caused', 'resolved_by', 'reminded_of', 'contradicts', 'continues');--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "entity_type" NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"first_mentioned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_mentioned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"salience" real DEFAULT 0.5 NOT NULL,
	"mention_count" integer DEFAULT 1 NOT NULL,
	"source" "semantic_source" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"tick_id" text NOT NULL,
	"context" text NOT NULL,
	"sentiment" real DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_entity_id" uuid NOT NULL,
	"target_entity_id" uuid NOT NULL,
	"relation_type" text NOT NULL,
	"strength" real DEFAULT 0.5 NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone,
	"source" "semantic_source" NOT NULL,
	"episode_id" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episode_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_episode_id" text NOT NULL,
	"target_episode_id" text NOT NULL,
	"link_type" "episode_link_type" NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "procedures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger" jsonb NOT NULL,
	"strategy" text NOT NULL,
	"success_rate" real DEFAULT 0.5 NOT NULL,
	"times_applied" integer DEFAULT 0 NOT NULL,
	"times_succeeded" integer DEFAULT 0 NOT NULL,
	"last_applied_at" timestamp with time zone,
	"emotional_context" text,
	"source" text DEFAULT 'interaction' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entity_mentions" ADD CONSTRAINT "entity_mentions_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_relations" ADD CONSTRAINT "entity_relations_source_entity_id_entities_id_fk" FOREIGN KEY ("source_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_relations" ADD CONSTRAINT "entity_relations_target_entity_id_entities_id_fk" FOREIGN KEY ("target_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_entities_name" ON "entities" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_entities_type" ON "entities" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_entities_salience" ON "entities" USING btree ("salience");--> statement-breakpoint
CREATE INDEX "idx_entities_last_mentioned" ON "entities" USING btree ("last_mentioned_at");--> statement-breakpoint
CREATE INDEX "idx_entity_mentions_entity" ON "entity_mentions" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_entity_mentions_tick" ON "entity_mentions" USING btree ("tick_id");--> statement-breakpoint
CREATE INDEX "idx_entity_relations_source" ON "entity_relations" USING btree ("source_entity_id");--> statement-breakpoint
CREATE INDEX "idx_entity_relations_target" ON "entity_relations" USING btree ("target_entity_id");--> statement-breakpoint
CREATE INDEX "idx_entity_relations_type" ON "entity_relations" USING btree ("relation_type");--> statement-breakpoint
CREATE INDEX "idx_episode_links_source" ON "episode_links" USING btree ("source_episode_id");--> statement-breakpoint
CREATE INDEX "idx_episode_links_target" ON "episode_links" USING btree ("target_episode_id");--> statement-breakpoint
CREATE INDEX "idx_procedures_success_rate" ON "procedures" USING btree ("success_rate");--> statement-breakpoint
CREATE INDEX "idx_procedures_created_at" ON "procedures" USING btree ("created_at");