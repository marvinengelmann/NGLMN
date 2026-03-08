CREATE TABLE "genesis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seed" integer NOT NULL,
	"dna" jsonb NOT NULL,
	"identity" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
