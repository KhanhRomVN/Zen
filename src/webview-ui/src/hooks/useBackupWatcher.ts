import { useState, useEffect, useRef } from "react";
import { extensionService } from "../services/ExtensionService";

export const useBackupWatcher = (currentConversationId: string) => {
  const [backupEventCount, setBackupEventCount] = useState(0);
  const currentConversationIdRef = useRef(currentConversationId);

  useEffect(() => {
    currentConversationIdRef.current = currentConversationId;
  }, [currentConversationId]);

  // Start/Switch backup watch on conversation change
  useEffect(() => {
    if (currentConversationId) {
      extensionService.postMessage({
        command: "startBackupWatch",
        conversationId: currentConversationId,
      });
    }
  }, [currentConversationId]);

  // Cleanup backup watch on unmount
  useEffect(() => {
    return () => {
      if (currentConversationIdRef.current) {
        extensionService.postMessage({
          command: "stopBackupWatch",
        });
      }
    };
  }, []);

  // Listen for backup events
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === "backupEventAdded") {
        setBackupEventCount((prev) => prev + 1);
      } else if (message.command === "backupSizeWarning") {
        console.warn(`[BackupWatcher] Size warning for ${message.filePath}`);
      } else if (
        message.command === "backupTimelineResult" &&
        message.requestId === "watcher-initial"
      ) {
        if (message.timeline) {
          setBackupEventCount(message.timeline.length);
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Fetch initial timeline count when conversation changes
  useEffect(() => {
    if (currentConversationId) {
      extensionService.postMessage({
        command: "getBackupTimeline",
        conversationId: currentConversationId,
        requestId: "watcher-initial",
      });
    }
  }, [currentConversationId]);

  return { backupEventCount };
};
