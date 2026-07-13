import { useState, useEffect, useRef } from "react";
import { extensionService } from "../../../../services/ExtensionService";

/**
 * Polls the VS Code extension for active terminal IDs every 2 seconds.
 */
export const useTerminalPolling = () => {
  const renderCountRef = useRef(0);
  const pollCountRef = useRef(0);
  const updateCountRef = useRef(0);

  renderCountRef.current += 1;

  const [activeTerminalIds, setActiveTerminalIds] = useState<Set<string>>(
    new Set(),
  );
  const [attachedTerminalIds, setAttachedTerminalIds] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    const effectStartTime = performance.now();
    const fetchTerminals = () => {
      pollCountRef.current += 1;
      extensionService.postMessage({
        command: "listTerminals",
        requestId: `chat-panel-poll-${Date.now()}`,
      });
    };

    fetchTerminals();
    const interval = setInterval(fetchTerminals, 2000);

    const handleMessage = (event: MessageEvent) => {
      const messageStartTime = performance.now();
      const message = event.data;

      if (
        message.command === "listTerminalsResult" &&
        message.requestId?.startsWith("chat-panel-poll-")
      ) {
        if (message.terminals) {
          updateCountRef.current += 1;

          const allIds = new Set<string>();
          const attachedIds = new Set<string>();
          message.terminals.forEach((t: any) => {
            allIds.add(t.id);
            if (t.isAttached) attachedIds.add(t.id);
          });

          setActiveTerminalIds(allIds);
          setAttachedTerminalIds(attachedIds);
        }
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearInterval(interval);
    };
  }, []);

  return { activeTerminalIds, attachedTerminalIds };
};
