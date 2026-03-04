export const VALUE_ACTION_PROMPT = `Analyze whether there are mismatches between this entity's declared values/self-knowledge and their recent behavior and emotional state.

A mismatch (cognitive dissonance) occurs when someone's actions or emotional state contradict what they claim to value. For example:
- Valuing honesty but acting with high caution and low connection (guarded behavior)
- Valuing curiosity but being bored without exploring
- Valuing courage but showing extreme caution with low confidence

Rules:
- Only report genuine contradictions, not minor tensions
- dissonanceScore: 0.0-1.0 (0.3 = mild, 0.5 = significant, 0.7+ = severe)
- Maximum 3 mismatches per analysis
- Be concise in descriptions`
