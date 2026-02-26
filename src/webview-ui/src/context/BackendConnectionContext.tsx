import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

interface BackendConnectionContextType {
  isConnected: boolean;
  isElaraMismatch: boolean;
  isChecking: boolean;
  checkConnection: () => Promise<void>;
  apiUrl: string;
}

const BackendConnectionContext = createContext<
  BackendConnectionContextType | undefined
>(undefined);

const CHECK_INTERVAL = 5000; // 5 seconds
const HEALTH_ENDPOINT = "/v1/health";

export const BackendConnectionProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [isConnected, setIsConnected] = useState(true); // Assume connected initially
  const [isElaraMismatch, setIsElaraMismatch] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [apiUrl, setApiUrl] = useState("http://localhost:8888");

  const checkConnection = async () => {
    setIsChecking(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(`${apiUrl}${HEALTH_ENDPOINT}`, {
        signal: controller.signal,
        method: "GET",
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const connected = data.status === "ok";
        setIsConnected(connected);

        if (connected) {
          setIsElaraMismatch(data.elara !== "khanhromvn/elara");
        } else {
          setIsElaraMismatch(false);
        }
      } else {
        setIsConnected(false);
        setIsElaraMismatch(false);
      }
    } catch (e) {
      setIsConnected(false);
      setIsElaraMismatch(false);
    } finally {
      setIsChecking(false);
    }
  };

  // Load API URL from storage
  useEffect(() => {
    const loadApiUrl = async () => {
      const storage = (window as any).storage;
      if (storage) {
        try {
          const res = await storage.get("backend-api-url");
          if (res?.value) {
            setApiUrl(res.value);
          }
        } catch (e) {
          // Ignore
        }
      }
    };
    loadApiUrl();
  }, []);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [apiUrl]);

  // Listen for storage changes from extension host
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (
        message.command === "storageSetResponse" ||
        message.command === "storageGetResponse"
      ) {
        // API URL might have changed, but storage doesn't notify webview automatically unless we poll or extension sends message.
        // In Zen, storage is handled via messages.
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <BackendConnectionContext.Provider
      value={{
        isConnected,
        isElaraMismatch,
        isChecking,
        checkConnection,
        apiUrl,
      }}
    >
      {children}
    </BackendConnectionContext.Provider>
  );
};

export const useBackendConnection = () => {
  const context = useContext(BackendConnectionContext);
  if (context === undefined) {
    throw new Error(
      "useBackendConnection must be used within a BackendConnectionProvider",
    );
  }
  return context;
};
