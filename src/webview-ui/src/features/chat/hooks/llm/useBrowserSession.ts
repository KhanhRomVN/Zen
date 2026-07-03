import { useState, useEffect, useCallback } from "react";

/**
 * Manages browser session state for the zai-browser provider.
 * Checks session status on mount and polls every 5 seconds.
 */
export const useBrowserSession = (
  currentModel: any,
  currentAccount: any,
  backendApiUrl: string,
) => {
  const [isBrowserSessionReady, setIsBrowserSessionReady] = useState(false);
  const [showBrowserWarning, setShowBrowserWarning] = useState(false);
  const [isLaunchingBrowser, setIsLaunchingBrowser] = useState(false);

  const checkBrowserSession = useCallback(async () => {
    if (!currentModel || currentModel.providerId !== "zai-browser") {
      setIsBrowserSessionReady(true);
      setShowBrowserWarning(false);
      return;
    }
    if (!currentAccount?.id) {
      setIsBrowserSessionReady(false);
      setShowBrowserWarning(true);
      return;
    }
    try {
      const response = await fetch(
        `${backendApiUrl}/v1/accounts/${currentAccount.id}/browser/status`,
      );
      const result = await response.json();
      if (result.success && result.data) {
        if (result.data.has_profile && result.data.is_running) {
          setIsBrowserSessionReady(true);
          setShowBrowserWarning(false);
        } else {
          setIsBrowserSessionReady(false);
          setShowBrowserWarning(true);
        }
      } else {
        setIsBrowserSessionReady(false);
        setShowBrowserWarning(true);
      }
    } catch (error) {
      console.error("Failed to check browser session:", error);
      setIsBrowserSessionReady(false);
      setShowBrowserWarning(true);
    }
  }, [currentModel, currentAccount, backendApiUrl]);

  const launchBrowserSession = async () => {
    if (!currentModel || !currentAccount) return;
    setIsLaunchingBrowser(true);
    try {
      const response = await fetch(
        `${backendApiUrl}/v1/accounts/${currentAccount.id}/browser/start`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const result = await response.json();
      if (result.success) {
        setIsBrowserSessionReady(true);
        setShowBrowserWarning(false);
      } else {
        console.error("Failed to launch browser:", result.message);
      }
    } catch (error) {
      console.error("Failed to launch browser:", error);
    } finally {
      setIsLaunchingBrowser(false);
    }
  };

  // Initial check
  useEffect(() => {
    checkBrowserSession();
  }, [checkBrowserSession]);

  // Poll every 5 seconds for zai-browser provider
  useEffect(() => {
    if (
      !currentModel ||
      currentModel.providerId !== "zai-browser" ||
      !currentAccount?.id
    )
      return;
    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `${backendApiUrl}/v1/accounts/${currentAccount.id}/browser/status`,
        );
        const result = await response.json();
        if (result.success && result.data) {
          const isRunning = result.data.is_running === true;
          setIsBrowserSessionReady(isRunning);
          setShowBrowserWarning(!isRunning);
        }
      } catch (error) {
        console.error("Polling browser status failed:", error);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [currentModel, currentAccount?.id, backendApiUrl]);

  return {
    isBrowserSessionReady,
    showBrowserWarning,
    isLaunchingBrowser,
    launchBrowserSession,
  };
};
