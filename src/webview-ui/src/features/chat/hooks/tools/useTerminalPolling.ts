import { useState, useEffect, useRef } from "react";
import { extensionService } from "../../../../services/ExtensionService";
import { createLogger } from "../../utils/performanceLogger";

const log = createLogger('useTerminalPolling');

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

  log.render('useTerminalPolling', {
    renderCount: renderCountRef.current,
    activeTerminals: activeTerminalIds.size,
    attachedTerminals: attachedTerminalIds.size
  });

  useEffect(() => {
    const effectStartTime = performance.now();
    
    log.state('terminalPolling_setup', {});

    const fetchTerminals = () => {
      pollCountRef.current += 1;
      log.state('fetchTerminals', { pollCount: pollCountRef.current });
      
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
          
          log.state('terminals_update', {
            updateCount: updateCountRef.current,
            totalTerminals: allIds.size,
            attachedTerminals: attachedIds.size,
            terminals: message.terminals.map((t: any) => ({ id: t.id, attached: t.isAttached }))
          });
          
          setActiveTerminalIds(allIds);
          setAttachedTerminalIds(attachedIds);
          
          log.perf('handleMessage_terminals', messageStartTime, {});
        }
      }
    };

    window.addEventListener("message", handleMessage);
    
    log.perf('terminalPolling_setup_complete', effectStartTime, {});
    
    return () => {
      log.state('terminalPolling_cleanup', {
        pollCount: pollCountRef.current,
        updateCount: updateCountRef.current
      });
      window.removeEventListener("message", handleMessage);
      clearInterval(interval);
    };
  }, []);

  return { activeTerminalIds, attachedTerminalIds };
};
