import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Manages browser session state for the zai-browser provider.
 * Checks session status on mount and polls every 5 seconds.
 * 
 * PERFORMANCE: Uses refs to prevent unnecessary re-renders from polling.
 */
export const useBrowserSession = (
  currentModel: any,
  currentAccount: any,
  backendApiUrl: string,
) => {
  const [isBrowserSessionReady, setIsBrowserSessionReady] = useState(false);
  const [showBrowserWarning, setShowBrowserWarning] = useState(false);
  const [isLaunchingBrowser, setIsLaunchingBrowser] = useState(false);

  // Use refs to track current state values to avoid unnecessary re-renders
  const isBrowserSessionReadyRef = useRef(false);
  const showBrowserWarningRef = useRef(false);
  
  // Use refs for dependencies to prevent interval recreation
  const currentModelRef = useRef(currentModel);
  const currentAccountRef = useRef(currentAccount);
  const backendApiUrlRef = useRef(backendApiUrl);
  
  // Update refs when values change
  useEffect(() => {
    currentModelRef.current = currentModel;
    currentAccountRef.current = currentAccount;
    backendApiUrlRef.current = backendApiUrl;
  }, [currentModel, currentAccount, backendApiUrl]);

  const checkBrowserSession = useCallback(async () => {
    if (!currentModel || currentModel.providerId !== "zai-browser") {
      // PERF: Only setState if values actually changed — avoids triggering
      // a re-render when the effect re-runs due to dep reference changes
      // but the logical state is already correct.
      if (!isBrowserSessionReadyRef.current) {
        isBrowserSessionReadyRef.current = true;
        setIsBrowserSessionReady(true);
      }
      if (showBrowserWarningRef.current) {
        showBrowserWarningRef.current = false;
        setShowBrowserWarning(false);
      }
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
  // PERFORMANCE: Only set up interval once, use refs to access latest values
  useEffect(() => {
    const checkStatus = async () => {
      const model = currentModelRef.current;
      const account = currentAccountRef.current;
      const apiUrl = backendApiUrlRef.current;
      
      if (!model || model.providerId !== "zai-browser" || !account?.id) {
        // PERF: When provider is not zai-browser, these states should already be
        // true/false from the initial check. Skip setState entirely to avoid
        // unnecessary re-renders on every 5s poll interval.
        // Only sync refs silently — no setState needed.
        isBrowserSessionReadyRef.current = true;
        showBrowserWarningRef.current = false;
        return;
      }
      
      try {
        const response = await fetch(
          `${apiUrl}/v1/accounts/${account.id}/browser/status`,
        );
        const result = await response.json();
        if (result.success && result.data) {
          const isRunning = result.data.has_profile && result.data.is_running;
          
          // Only update state if values actually changed
          if (isBrowserSessionReadyRef.current !== isRunning) {
            isBrowserSessionReadyRef.current = isRunning;
            setIsBrowserSessionReady(isRunning);
          }
          if (showBrowserWarningRef.current !== !isRunning) {
            showBrowserWarningRef.current = !isRunning;
            setShowBrowserWarning(!isRunning);
          }
        }
      } catch (error) {
        console.error("Polling browser status failed:", error);
      }
    };
    
    // Initial check
    checkStatus();
    
    // Set up polling - only created once
    const interval = setInterval(checkStatus, 5000);
    
    return () => clearInterval(interval);
  }, []); // Empty deps - interval is set up once and uses refs

  return {
    isBrowserSessionReady,
    showBrowserWarning,
    isLaunchingBrowser,
    launchBrowserSession,
  };
};
