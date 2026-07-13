import { useState, useEffect } from "react";
import { extensionService } from "../../../../services/ExtensionService";

/**
 * Hook to manage API URL and providers configuration
 */
export const useApiConfiguration = () => {
  const [apiUrl, setApiUrl] = useState("http://localhost:8888");
  const [isApiUrlReady, setIsApiUrlReady] = useState(false);
  const [providers, setProviders] = useState<any[]>([]);

  // Load API URL from storage
  useEffect(() => {
    const storage = extensionService.getStorage();
    storage
      .get("backend-api-url")
      .then((res: any) => {
        if (res?.value?.startsWith("http")) {
          const url = res.value.endsWith("/")
            ? res.value.slice(0, -1)
            : res.value;
          setApiUrl(url);
        }
        setIsApiUrlReady(true);
      })
      .catch((err: any) => {
        console.warn(
          "[Zen] ChatPanel failed to load apiUrl from storage:",
          err,
        );
        setIsApiUrlReady(true);
      });
  }, []);

  // Fetch providers from API
  useEffect(() => {
    if (!apiUrl) return;
    fetch(`${apiUrl}/v1/providers`)
      .then((r) => r.json())
      .then((res: any) => {
        const data = Array.isArray(res) ? res : res?.data;
        if (Array.isArray(data)) setProviders(data);
      })
      .catch(() => {});
  }, [apiUrl]);

  return {
    apiUrl,
    setApiUrl,
    isApiUrlReady,
    providers,
    setProviders,
  };
};
