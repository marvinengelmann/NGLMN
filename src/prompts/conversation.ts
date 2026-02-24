export const CONVERSATION_BOUNDARY_PROMPT = `Determine if new messages continue an existing conversation or start a new topic.
Respond with ONLY valid JSON: {"isNewConversation": true/false, "reason": "brief reason"}`
