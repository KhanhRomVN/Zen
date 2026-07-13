import { useMemo, useRef } from "react";
import { Message } from "../../types/message";
import { createLogger } from "../../utils/performanceLogger";

const log = createLogger('useFileStats');

interface FileStats {
  totalFiles: number;
  totalAdditions: number;
  totalDeletions: number;
}

/**
 * Hook to calculate conversation file statistics with incremental computation
 */
export const useFileStats = (
  messages: Message[],
  loadedConversationFileStats: FileStats | null,
): FileStats => {
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

  //   Track last computed file stats for incremental updates
  const lastFileStatsLengthRef = useRef(0);
  const lastFileStatsMapRef = useRef<
    Map<string, { additions: number; deletions: number }>
  >(new Map());

  const conversationFileStats = useMemo(() => {
    const startTime = performance.now();
    
    // If we have loaded stats from history and no new messages, use loaded stats
    if (
      loadedConversationFileStats &&
      messages.length > 0 &&
      messages.every(
        (m) =>
          !m.content?.includes("<write_to_file>") &&
          !m.content?.includes("<str_replace>"),
      )
    ) {
      log.cache('fileStats_use_loaded', true, {
        renderCount: renderCountRef.current,
        totalFiles: loadedConversationFileStats.totalFiles
      });
      return loadedConversationFileStats;
    }

    // PERF OPTIMIZATION: Incremental computation - only scan new messages
    const canUseIncremental = messages.length >= lastFileStatsLengthRef.current;

    let fileChanges: Map<string, { additions: number; deletions: number }>;

    if (canUseIncremental && lastFileStatsLengthRef.current > 0) {
      // Start from previous map and scan only new messages
      fileChanges = new Map(lastFileStatsMapRef.current);

      const newMessages = messages.slice(lastFileStatsLengthRef.current);
      
      log.cache('fileStats_incremental', true, {
        renderCount: renderCountRef.current,
        previousLength: lastFileStatsLengthRef.current,
        currentLength: messages.length,
        newMessagesCount: newMessages.length,
        previousFilesCount: fileChanges.size
      });
      
      scanMessagesForFileChanges(newMessages, fileChanges);
    } else {
      // Full scan (messages were edited or first render)
      fileChanges = new Map();
      
      log.cache('fileStats_full', false, {
        renderCount: renderCountRef.current,
        messagesCount: messages.length,
        reason: lastFileStatsLengthRef.current === 0 ? 'first_render' : 'messages_edited'
      });
      
      scanMessagesForFileChanges(messages, fileChanges);
    }

    // Cache map for next incremental update
    lastFileStatsLengthRef.current = messages.length;
    lastFileStatsMapRef.current = fileChanges;

    const totalFiles = fileChanges.size;
    const totalAdditions = Array.from(fileChanges.values()).reduce(
      (sum, stat) => sum + stat.additions,
      0,
    );
    const totalDeletions = Array.from(fileChanges.values()).reduce(
      (sum, stat) => sum + stat.deletions,
      0,
    );

    log.perf('fileStats_useMemo', startTime, {
      renderCount: renderCountRef.current,
      messagesCount: messages.length,
      totalFiles,
      totalAdditions,
      totalDeletions,
      incremental: canUseIncremental && lastFileStatsLengthRef.current > 0
    });

    return {
      totalFiles,
      totalAdditions,
      totalDeletions,
    };
  }, [messages, loadedConversationFileStats]);

  return conversationFileStats;
};

/**
 * Helper function to scan messages for file changes
 */
function scanMessagesForFileChanges(
  messagesToScan: Message[],
  fileChanges: Map<string, { additions: number; deletions: number }>,
) {
  messagesToScan.forEach((msg) => {
    if (msg.role === "assistant" && msg.content) {
      // Match write_to_file
      const writeMatches = msg.content.matchAll(
        /<write_to_file>\s*<file_path>([^<]+)<\/file_path>\s*<content>([\s\S]*?)<\/content>\s*<\/write_to_file>/g,
      );

      for (const match of writeMatches) {
        const filePath = match[1];
        const content = match[2];

        if (filePath) {
          if (!fileChanges.has(filePath)) {
            fileChanges.set(filePath, { additions: 0, deletions: 0 });
          }

          const stats = fileChanges.get(filePath)!;
          const lines = content.split("\n").length;
          stats.additions += lines;
        }
      }

      // Match str_replace
      const replaceMatches = msg.content.matchAll(
        /<str_replace>\s*<file_path>([^<]+)<\/file_path>\s*<old_str>([\s\S]*?)<\/old_str>\s*<new_str>([\s\S]*?)<\/new_str>\s*<\/str_replace>/g,
      );

      for (const match of replaceMatches) {
        const filePath = match[1];
        const oldStr = match[2];
        const newStr = match[3];

        if (filePath) {
          if (!fileChanges.has(filePath)) {
            fileChanges.set(filePath, { additions: 0, deletions: 0 });
          }

          const stats = fileChanges.get(filePath)!;
          const oldLines = oldStr.split("\n").length;
          const newLines = newStr.split("\n").length;

          stats.deletions += oldLines;
          stats.additions += newLines;
        }
      }
    }
  });
}
