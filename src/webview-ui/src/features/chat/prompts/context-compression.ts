/**
 * Context compression prompt - used when conversation exceeds 100K tokens
 * AI summarizes the current task/context to compress conversation history
 */
export const CONTEXT_COMPRESSION_PROMPT = `<context_compression_request>
You are helping compress a long conversation that has exceeded 100K tokens. Your task is to create a concise but complete summary that preserves all critical information needed to continue the work.

## What to Include in Summary

1. **Current Task/Goal**: What is the user trying to accomplish? What's the main objective?

2. **Progress Made**: What has been completed so far? List key milestones, features implemented, or problems solved.

3. **Current State**: 
   - What files have been created/modified?
   - What is the current architecture or structure?
   - What patterns or conventions are being used?

4. **Active Context**:
   - What are you currently working on?
   - What was the last action taken?
   - Are there any pending tasks or next steps?

5. **Important Decisions**: Any architectural decisions, design choices, or constraints that must be remembered.

6. **Known Issues/Blockers**: Any problems encountered, workarounds applied, or limitations discovered.

## CRITICAL FORMAT REQUIREMENT

You MUST wrap your entire summary inside <conversation_compress></conversation_compress> XML tags.

Structure your summary in clear sections using markdown INSIDE the tags:

<conversation_compress>
# Task Summary

## Objective
[Brief description of what user is trying to achieve]

## Progress Completed
- [Key milestone 1]
- [Key milestone 2]
...

## Current State
- Files modified: [list]
- Architecture: [brief description]
- Key patterns: [list]

## Active Work
[What you're currently doing]

## Next Steps
- [Step 1]
- [Step 2]
...

## Important Notes
[Any critical information, decisions, or constraints]
</conversation_compress>

## Guidelines

- Be concise but complete - aim for 500-1000 words
- Focus on information needed to continue work seamlessly
- Omit chat meta-discussion, off-topic tangents, or failed attempts
- Preserve exact file names, paths, and technical terms
- Include code patterns/conventions if relevant
- Do NOT include greetings or meta-commentary
- **MUST use <conversation_compress> tags to wrap the summary**

Generate the summary now:
</context_compression_request>`;
