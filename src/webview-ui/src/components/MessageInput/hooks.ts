import React from "react";

export const useToggleState = (key: string, defaultValue: boolean = false) => {
  const [state, setState] = React.useState(() => {
    try {
      return localStorage.getItem(key) === "true";
    } catch {
      return defaultValue;
    }
  });

  const toggle = React.useCallback(() => {
    setState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(key, String(next));
      } catch {}
      return next;
    });
  }, [key]);

  return [state, toggle, setState] as const;
};

export const useModelCapabilities = (
  currentModel: any,
  currentModelConfig: any,
  currentProviderConfig: any,
) => {
  const showThinkingButton = React.useMemo(() => {
    return currentModel?.is_thinking !== undefined
      ? !!currentModel.is_thinking
      : !!currentModelConfig?.is_thinking;
  }, [currentModel, currentModelConfig]);

  const showSearchButton = React.useMemo(() => {
    let result: boolean;
    if (currentModel?.is_search !== undefined) {
      result = !!currentModel.is_search;
    } else if (currentModelConfig?.is_search !== undefined) {
      result = !!currentModelConfig.is_search;
    } else {
      result = !!currentProviderConfig?.is_search;
    }
    return result;
  }, [currentModel, currentModelConfig, currentProviderConfig]);

  const showMemoryButton = React.useMemo(() => {
    return currentModel?.is_memory === true;
  }, [currentModel]);

  const supportsUpload = React.useMemo(() => {
    let result: boolean;
    if (currentModel?.is_upload !== undefined) {
      result = !!currentModel.is_upload;
    } else if (currentModelConfig?.is_upload !== undefined) {
      result = !!currentModelConfig.is_upload;
    } else {
      result = !!currentProviderConfig?.is_upload;
    }
    return result;
  }, [currentModel, currentProviderConfig, currentModelConfig]);

  return {
    showThinkingButton,
    showSearchButton,
    showMemoryButton,
    supportsUpload,
  };
};

export const useProvidersConfig = (
  currentModel: any,
  providers: any[],
) => {
  const currentProviderConfig = React.useMemo(() => {
    if (!currentModel?.providerId) {
      return null;
    }
    const found = providers.find(
      (p) =>
        p.provider_id?.toLowerCase() === currentModel.providerId?.toLowerCase(),
    );
    return found ?? null;
  }, [currentModel, providers]);

  const currentModelConfig = React.useMemo(() => {
    if (!currentProviderConfig || !currentModel?.id) {
      return null;
    }
    const found = currentProviderConfig.models?.find(
      (m: any) => m.id?.toLowerCase() === currentModel.id?.toLowerCase(),
    );
    return found ?? null;
  }, [currentProviderConfig, currentModel]);

  return { currentProviderConfig, currentModelConfig };
};

/**
 * 🚀 PERFORMANCE FIX: Use requestAnimationFrame to batch textarea resizes
 * This prevents excessive layout recalculations during rapid typing
 */
export const useTextareaAutoResize = (
  textareaRef: React.RefObject<HTMLTextAreaElement>,
  message: string,
) => {
  const rafIdRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    // Cancel any pending resize
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    // Schedule resize in next animation frame
    rafIdRef.current = requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      
      el.style.height = "auto";
      const maxHeight = 240;
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
      el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
      
      rafIdRef.current = null;
    });

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [message, textareaRef]);
};

export const useModelSelection = (
  folderPath: string | null | undefined,
  setCurrentModel: (model: any) => void,
  setCurrentAccount: (account: any) => void,
  currentModel: any,
  currentAccount: any,
) => {
  const [isLoadingCache, setIsLoadingCache] = React.useState(true);
  const pendingAccountIdRef = React.useRef<string | null>(null);
  const currentModelRef = React.useRef<any>(null);
  const currentAccountRef = React.useRef<any>(null);
  
  currentModelRef.current = currentModel;
  currentAccountRef.current = currentAccount;

  // Load saved selection
  React.useEffect(() => {
    let cancelled = false;
    setIsLoadingCache(true);
    const key = `zen-model-selection:${folderPath || "global"}`;

    const applyCache = (saved: any) => {
      if (cancelled) return;
      if (saved.model && !currentModelRef.current) setCurrentModel(saved.model);
      if (saved.accountId && !currentAccountRef.current) {
        pendingAccountIdRef.current = saved.accountId;
        if (saved.email) {
          setCurrentAccount({ id: saved.accountId, email: saved.email });
        }
      }
    };

    try {
      const savedStr = localStorage.getItem(key);
      if (savedStr) {
        const saved = JSON.parse(savedStr);
        applyCache(saved);
        setIsLoadingCache(false);
      } else {
        const storage = (window as any).storage;
        if (storage) {
          storage
            .get(key)
            .then((res: any) => {
              if (cancelled) return;
              if (res?.value) {
                const saved = JSON.parse(res.value);
                applyCache(saved);
                try {
                  localStorage.setItem(key, res.value);
                } catch {}
              }
              setIsLoadingCache(false);
            })
            .catch(() => {
              if (!cancelled) setIsLoadingCache(false);
            });
        } else {
          setIsLoadingCache(false);
        }
      }
    } catch (e) {
      setIsLoadingCache(false);
    }

    return () => {
      cancelled = true;
    };
  }, [folderPath, setCurrentModel, setCurrentAccount]);

  // Save selection
  React.useEffect(() => {
    if (currentModel) {
      const key = `zen-model-selection:${folderPath || "global"}`;
      const data = {
        model: currentModel,
        accountId: currentAccount?.id,
        email: currentAccount?.email,
      };
      const dataStr = JSON.stringify(data);
      try {
        localStorage.setItem(key, dataStr);
      } catch (e) {}

      const storage = (window as any).storage;
      if (storage) {
        storage.set(key, dataStr);
      }
    }
  }, [currentModel, currentAccount, folderPath]);

  return {
    isLoadingCache,
    pendingAccountIdRef,
  };
};
