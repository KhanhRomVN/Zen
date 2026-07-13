import { useMemo, useRef } from "react";
import { Message } from "../../types/message";

interface ContextUsage {
  prompt: number;
  completion: number;
  total: number;
}

/**
 * Hook to calculate context token usage with incremental computation
 */
export const useContextUsage = (messages: Message[]): ContextUsage => {
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

  const lastContextUsageLengthRef = useRef(0);
  const lastContextUsageRef = useRef<ContextUsage>({
    prompt: 0,
    completion: 0,
    total: 0,
  });

  const contextUsage = useMemo(() => {
    const startTime = performance.now();

    const canUseIncremental =
      messages.length >= lastContextUsageLengthRef.current;

    let result: ContextUsage;

    if (canUseIncremental && lastContextUsageLengthRef.current > 0) {
      // Start from previous result and add new messages
      result = { ...lastContextUsageRef.current };

      const newMessages = messages.slice(lastContextUsageLengthRef.current);

      for (const msg of newMessages) {
        if (msg.isCancelled) continue;
        if (msg.token_usage) {
          result.total += msg.token_usage;
          if (msg.usage) {
            result.prompt += msg.usage.prompt_tokens || 0;
            result.completion += msg.usage.completion_tokens || 0;
          } else if (msg.role === "user") {
            result.prompt += msg.token_usage;
          } else {
            result.completion += msg.token_usage;
          }
        } else if (msg.usage) {
          result.prompt += msg.usage.prompt_tokens || 0;
          result.completion += msg.usage.completion_tokens || 0;
          result.total += msg.usage.total_tokens || 0;
        }
      }
    } else {
      result = messages.reduce(
        (acc, msg) => {
          if (msg.isCancelled) return acc;
          if (msg.token_usage) {
            acc.total += msg.token_usage;
            if (msg.usage) {
              acc.prompt += msg.usage.prompt_tokens || 0;
              acc.completion += msg.usage.completion_tokens || 0;
            } else if (msg.role === "user") {
              acc.prompt += msg.token_usage;
            } else {
              acc.completion += msg.token_usage;
            }
          } else if (msg.usage) {
            acc.prompt += msg.usage.prompt_tokens || 0;
            acc.completion += msg.usage.completion_tokens || 0;
            acc.total += msg.usage.total_tokens || 0;
          }
          return acc;
        },
        { prompt: 0, completion: 0, total: 0 },
      );
    }

    // Cache result for next incremental update
    lastContextUsageLengthRef.current = messages.length;
    lastContextUsageRef.current = result;
    return result;
  }, [messages]);

  return contextUsage;
};
