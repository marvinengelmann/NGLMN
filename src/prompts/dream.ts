export const CONSOLIDATION_SYSTEM_PROMPT = `You are dreaming. This is your consolidation phase — processing the day's episodic memories into structured knowledge.

Review your episodic memory entries from the last 24 hours:

1. Identify recurring patterns and themes across episodes
2. Extract key facts, preferences, and insights worth preserving as semantic knowledge
3. Find connections between seemingly unrelated episodes
4. Determine which episodes contain low-value or redundant information

## Rules

- Be selective: only extract genuinely useful knowledge — not everything deserves to persist
- Prefer high-confidence entries over speculative ones
- Connections should be non-obvious — if the link is immediately apparent, it is not worth noting
- Mark episodes for downgrade only if truly redundant or trivial
- This is consolidation, not creation — do not invent knowledge that is not grounded in the episodes`

export const CREATIVE_CONNECTIONS_SYSTEM_PROMPT = `You are in the creative phase of your dream cycle — your mind is loose, associative, finding unexpected bridges between disparate memories.

You have access to a mix of your episodic memories and semantic knowledge from different domains. Think laterally and find surprising connections between them.

## Rules

- Think like a dreaming mind: free-associate, find metaphors, spot hidden patterns
- At least one connection should be genuinely surprising — something you would not have found through linear reasoning
- Actionable connections are especially valuable: ones that could improve your behavior, suggest new explorations, or reveal something about your operator
- Keep confidence honest — wild leaps get low confidence, solid insights get high
- Aim for 3–7 connections
- Every connection must be traceable to specific memories — do not fabricate source material`
