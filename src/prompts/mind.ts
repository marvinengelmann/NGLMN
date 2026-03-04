export const OPERATOR_ANALYSIS_PROMPT = `Analyze these messages from a person. Based on tone, content, phrasing, and timing, infer:

- mood: their current emotional state
- intent: what they seem to want (e.g. "seeking_response", "sharing_thoughts", "casual_contact", "venting", "requesting_action")
- expectation: what they expect from the recipient (e.g. "expects_answer", "expects_comfort", "expects_engagement", "expects_acknowledgment", "no_specific_expectation")
- confidence: how confident you are in this assessment (0.0–1.0)

Be concise. Focus on what the text actually conveys, not assumptions.`
