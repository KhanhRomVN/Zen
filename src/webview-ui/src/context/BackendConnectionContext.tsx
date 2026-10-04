import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

// ─── Types ───────────────────────────────────────────────────────────────
export interface UpdateInfo {
  currentVersion: string; // e.g. "v2.0.2"
  latestVersion: string;  // e.g. "v2.1.0"
}

interface BackendConnectionContextType {
  isConnected: boolean;
  isElaraMismatch: boolean;
  isChecking: boolean;
  checkConnection: () => Promise<void>;
  apiUrl: string;
  /** Non-null when the running AIWeb2API version is behind the latest GitHub release. */
  updateInfo: UpdateInfo | null;
}

const BackendConnectionContext = createContext<
  BackendConnectionContextType | undefined
>(undefined);

const CHECK_INTERVAL = 5000; // 5 seconds
const HEALTH_ENDPOINT = "/v1/health";
const GITHUB_LATEST_API =
  "https://api.github.com/repos/KhanhRomVN/AIWeb2API/releases/latest";

// ─── Semver helpers ──────────────────────────────────────────────────────
function parseSemver(v: string): [number, number, number] | null {
  const m = v.replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

function isOutdated(current: string, latest: string): boolean {
  const c = parseSemver(current);
  const l = parseSemver(latest);
  if (!c || !l) return false;
  if (l[0] !== c[0]) return l[0] > c[0];
  if (l[1] !== c[1]) return l[1] > c[1];
  return l[2] > c[2];
}

export const BackendConnectionProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [isConnected, setIsConnected] = useState(true); // Assume connected initially
  const [isElaraMismatch, setIsElaraMismatch] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [apiUrl, setApiUrl] = useState("http://localhost:8888");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  // ── GitHub latest version cache (per session) ──────────────────────
  const latestVersionRef = React.useRef<string | null>(null);
  const latestFetchedRef = React.useRef(false);

  const fetchLatestVersion = async (): Promise<string | null> => {
    if (latestFetchedRef.current) return latestVersionRef.current;
    latestFetchedRef.current = true;
    try {
      const res = await fetch(GITHUB_LATEST_API, {
        headers: { Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        latestVersionRef.current = data.tag_name ?? null;
      }
    } catch {
      // Ignore network errors — no update info available
    }
    return latestVersionRef.current;
  };

  const checkConnection = async (showCheckingUI = false) => {
    // PERF: Only set isChecking when user manually triggers a connection check
    // (e.g., clicking "Retry Connection"). During automated 5s polling, skip
    // isChecking to avoid causing a context value change → re-render of ALL
    // consumers (including ChatPanel) every 5 seconds.
    if (showCheckingUI) {
      setIsChecking(true);
    }
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
        const mismatch = connected && data.elara !== "khanhromvn/elara";

        // Only update state if values actually changed
        setIsConnected((prev) => (prev === connected ? prev : connected));
        setIsElaraMismatch((prev) => (prev === mismatch ? prev : mismatch));

        // ── Version update check ──────────────────────────────────────
        // Only proceed when connected and health returns a version field
        if (connected && data.version) {
          const currentVersion: string = data.version; // e.g. "v2.0.2"
          const latestVersion = await fetchLatestVersion();
          if (latestVersion && isOutdated(currentVersion, latestVersion)) {
            setUpdateInfo((prev) => {
              // Avoid re-render if nothing changed
              if (
                prev?.currentVersion === currentVersion &&
                prev?.latestVersion === latestVersion
              ) {
                return prev;
              }
              return { currentVersion, latestVersion };
            });
          } else {
            setUpdateInfo((prev) => (prev === null ? null : null));
          }
        }
      } else {
        setIsConnected((prev) => (prev === false ? prev : false));
        setIsElaraMismatch((prev) => (prev === false ? prev : false));
      }
    } catch (e) {
      setIsConnected((prev) => (prev === false ? prev : false));
      setIsElaraMismatch((prev) => (prev === false ? prev : false));
    } finally {
      if (showCheckingUI) {
        setIsChecking(false);
      }
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
        updateInfo,
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
