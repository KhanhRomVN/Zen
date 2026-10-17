/**
 * Hook quét danh sách git repo trong workspace (đệ quy 4 cấp) — dùng
 * chung cho cả HomePanel và ChatPanel để tái sử dụng flow Generate
 * Commit Message.
 */

import { useCallback, useState } from "react";
import { extensionService, messageDispatcher } from "../services/ExtensionService";

export interface GitRepoInfo {
  relPath: string;
  absPath: string;
  branch: string;
  staged: number;
  unstaged: number;
  untracked: number;
  added: number;
  deleted: number;
  unpushed: number;
}

export interface GitCommitInfo {
  hash: string;
  subject: string;
  author: string;
  date: string;
}

export interface GitBranchInfo {
  name: string;
  isCurrent: boolean;
  unpushed: number;
  commits: GitCommitInfo[];
}

export interface GitFileInfo {
  path: string;
  status: string;
  staged: boolean;
}

export interface GitRepoDetail {
  branches: GitBranchInfo[];
  files: GitFileInfo[];
}

export const fetchGitRepoDetail = (absPath: string): Promise<GitRepoDetail> =>
  new Promise((resolve, reject) => {
    const requestId = `scanGitRepoDetail-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    messageDispatcher.register(
      requestId,
      (msg: any) => {
        if (msg.error || !msg.detail) {
          reject(new Error(msg.error || "No detail returned"));
        } else {
          resolve(msg.detail);
        }
        return false;
      },
      15000,
      () => reject(new Error("Load repo detail timeout")),
    );
    extensionService.postMessage({
      command: "scanGitRepoDetail",
      requestId,
      absPath,
    });
  });

export const useGitRepoScanner = () => {
  const [repos, setRepos] = useState<GitRepoInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback(async (): Promise<GitRepoInfo[]> => {
    setLoading(true);
    setError(null);
    const requestId = `scanGitRepos-${Date.now()}`;
    try {
      const result = await new Promise<{
        repos: GitRepoInfo[];
        error?: string;
      }>((resolve) => {
        messageDispatcher.register(
          requestId,
          (msg: any) => resolve({ repos: msg.repos || [], error: msg.error }),
          15000,
          () => resolve({ repos: [], error: "Scan git repos timeout" }),
        );
        extensionService.postMessage({ command: "scanGitRepos", requestId });
      });
      if (result.error) {
        setError(result.error);
        setRepos([]);
        return [];
      }
      setRepos(result.repos);
      return result.repos;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Scan failed";
      setError(message);
      setRepos([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return { repos, loading, error, scan };
};