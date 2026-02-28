ALTER TABLE "semantic_memory" DROP CONSTRAINT "uq_semantic_memory_category_key";--> statement-breakpoint
ALTER TABLE "semantic_memory" ADD COLUMN "scope" text;--> statement-breakpoint
CREATE INDEX "idx_semantic_memory_scope" ON "semantic_memory" USING btree ("scope");--> statement-breakpoint
ALTER TABLE "semantic_memory" ADD CONSTRAINT "uq_semantic_memory_category_key_scope" UNIQUE("category","key","scope");