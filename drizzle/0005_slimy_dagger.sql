CREATE INDEX "idx_evolution_log_created_at" ON "evolution_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_evolution_log_type_created" ON "evolution_log" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "idx_evolution_log_outcome_created" ON "evolution_log" USING btree ("outcome","created_at");--> statement-breakpoint
CREATE INDEX "idx_goals_title" ON "goals" USING btree ("title");--> statement-breakpoint
CREATE INDEX "idx_semantic_memory_updated_at" ON "semantic_memory" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_tick_log_created_at" ON "tick_log" USING btree ("created_at");