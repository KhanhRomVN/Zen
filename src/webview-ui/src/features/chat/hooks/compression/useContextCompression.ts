import { useCallback, useRef } from "react";
import { Message } from "../../types/message";
import { createLogger } from "../../utils/performanceLogger";

const log = createLogger('useContextCompression');

interface UseContextCompressionProps {
  currentConversationIdRef: React.MutableRefObject<string | null>;
  messages: Message[];
  isProcessing: boolean;
  sendMessage: (
    content: string,
    files: any[] | undefined,
    model: any,
    account: any,
    skipLogic: boolean | undefined,
    actionIds: string[] | undefined,
    uiHidden: boolean | undefined,
  ) => Promise<void>;
  currentModelRef: React.MutableRefObject<any>;
  currentAccountRef: React.MutableRefObject<any>;
}

/**
 * Hook to manage context compression functionality
 */
export const useContextCompression = ({
  currentConversationIdRef,
  messages,
  isProcessing,
  sendMessage,
  currentModelRef,
  currentAccountRef,
}: UseContextCompressionProps) => {
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

  log.render('useContextCompression', {
    renderCount: renderCountRef.current,
    messagesCount: messages.length,
    isProcessing
  });

  // Trigger context compression
  const triggerContextCompression = useCallback(() => {
    const callStartTime = performance.now();
    
    log.state('triggerContextCompression_start', {
      isProcessing,
      conversationId: currentConversationIdRef.current,
      messagesCount: messages.length
    });

    // Prevent multiple compression requests
    if (isProcessing) {
      console.warn(
        "[Zen][ContextCompression] Already processing - ignoring request",
      );
      log.state('compression_blocked', { reason: 'already_processing' });
      return;
    }

    try {
      // Inline CONTEXT_COMPRESSION_PROMPT to avoid dynamic import blocking
      const CONTEXT_COMPRESSION_PROMPT = `<context_compression_request>
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

**IMPORTANT**: There MUST NOT be ANY content after the closing </conversation_compress> tag. End your response immediately after closing the tag.

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
- **CRITICAL: Do NOT add any text, explanation, or content after the closing </conversation_compress> tag**

Generate the summary now:
</context_compression_request>`;

      // CRITICAL FIX: Use setTimeout to break out of the current call stack
      // This prevents UI freeze by allowing the browser to process pending updates
      setTimeout(() => {
        log.state('compression_setTimeout_execute', {});
        
        // Check if conversation exists
        const hasConversation =
          currentConversationIdRef.current && messages.length > 0;

        if (!hasConversation) {
          console.warn(
            "[Zen][ContextCompression] No active conversation - compression not possible",
          );
          log.state('compression_skip', { reason: 'no_conversation' });
          return;
        }

        log.state('compression_sendMessage', {
          conversationId: currentConversationIdRef.current,
          messagesCount: messages.length
        });

        // Use sendMessage directly instead of wrappedSendMessage to avoid ref issues
        // Use skipFirstRequestLogic=true since this is an internal request for existing conversation
        sendMessage(
          CONTEXT_COMPRESSION_PROMPT,
          undefined,
          currentModelRef.current, // Use ref to get latest model
          currentAccountRef.current, // Use ref to get latest account
          true, // skipFirstRequestLogic=true (conversation already exists)
          undefined,
          true, // uiHidden=true - hide internal compression request
        );
        
        log.perf('triggerContextCompression_complete', callStartTime, {});
      }, 0);
    } catch (error) {
      console.error(
        "[Zen][ContextCompression] Error triggering compression:",
        error,
      );
      log.state('compression_error', { error: String(error) });
    }
  }, [
    sendMessage,
    isProcessing,
    currentConversationIdRef,
    messages,
    currentModelRef,
    currentAccountRef,
  ]);

  const shouldShowCompressionButton = true; // Always show button

  return {
    triggerContextCompression,
    shouldShowCompressionButton,
  };
};
