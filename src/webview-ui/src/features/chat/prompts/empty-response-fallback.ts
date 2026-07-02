export const EMPTY_RESPONSE_FALLBACK = `⚠️ WARNING: Your previous response was invalid — it contained only an empty thinking block with no meaningful content, tool calls, or questions.

This is a critical error. You MUST NOT respond with only an empty thinking block.

If you have nothing to say or need clarification, you MUST ask a question.

If you are unsure about the task, ask for clarification rather than returning an empty response.

Now, please provide a proper response to the user's last message. Include:
- A thinking block with your plan and verification (as always)
- Then either:
  - Tool calls (if you know what to do)
  - A markdown summary with clear next steps
  - A question if you need clarification

Remember: Every response must have meaningful content after the thinking block.`;
