import { useState, useEffect, useRef } from "react";

function getKey(base: string, folderPath: string | null | undefined): string {
  return `${base}:${folderPath || "global"}`;
}

interface UseModelAccountOptions {
  /** Initial model value (e.g. from initialMessageData) — takes priority over cache */
  initialModel?: any;
  /** Initial account value (e.g. from initialMessageData) — takes priority over cache */
  initialAccount?: any;
}

interface UseModelAccountReturn {
  currentModel: any;
  setCurrentModel: (model: any) => void;
  currentAccount: any;
  setCurrentAccount: (account: any) => void;
}

/**
 * Centralized hook for model+account selection state with localStorage persistence.
 * Keys are workspace-scoped via folderPath to keep selections independent per workspace.
 *
 * Usage:
 *   const { currentModel, setCurrentModel, currentAccount, setCurrentAccount }
 *     = useModelAccount(folderPath, { initialModel, initialAccount });
 */
export function useModelAccount(
  folderPath: string | null | undefined,
  options: UseModelAccountOptions = {},
): UseModelAccountReturn {
  const { initialModel, initialAccount } = options;

  // Keep a ref to the latest initial values so the initializer can access them
  // without needing them in the dependency array (they only matter on first mount).
  const initialRef = useRef({ initialModel, initialAccount });
  initialRef.current = { initialModel, initialAccount };

  const [currentModel, setCurrentModel] = useState<any>(() => {
    if (initialRef.current.initialModel) return initialRef.current.initialModel;
    try {
      const key = getKey("zen_last_model", folderPath);
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  const [currentAccount, setCurrentAccount] = useState<any>(() => {
    if (initialRef.current.initialAccount) return initialRef.current.initialAccount;
    try {
      const key = getKey("zen_last_account", folderPath);
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  // Persist model changes
  useEffect(() => {
    if (currentModel) {
      const key = getKey("zen_last_model", folderPath);
      localStorage.setItem(key, JSON.stringify(currentModel));
    }
  }, [currentModel, folderPath]);

  // Persist account changes
  useEffect(() => {
    if (currentAccount) {
      const key = getKey("zen_last_account", folderPath);
      localStorage.setItem(key, JSON.stringify(currentAccount));
    }
  }, [currentAccount, folderPath]);

  return { currentModel, setCurrentModel, currentAccount, setCurrentAccount };
}