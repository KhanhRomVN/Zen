import { useEffect, useState } from "react";

interface VSCodeThemeMessage {
  command: "updateTheme";
  theme: number; // vscode.ColorThemeKind: 1=Light, 2=Dark, 3=HighContrast
  themeId?: string;
  themeVersion?: number;
}

// Declare global acquireVsCodeApi for TypeScript
declare global {
  interface Window {
    acquireVsCodeApi?: () => {
      postMessage: (message: any) => void;
      getState: () => any;
      setState: (state: any) => void;
    };
  }
}

export const useVSCodeTheme = () => {
  const [themeKind, setThemeKind] = useState<number>(2); // Mặc định dark theme (2)
  const [themeId, setThemeId] = useState<string | undefined>(undefined);
  const [themeVersion, setThemeVersion] = useState<number>(Date.now());

  useEffect(() => {
    // Hàm xử lý message từ VS Code extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data as VSCodeThemeMessage;
      if (message.command === "updateTheme") {
        setThemeKind(message.theme);
        if (message.themeId) {
          setThemeId(message.themeId);
        }
        if (message.themeVersion) {
          setThemeVersion(message.themeVersion);
        }
      }
    };

    // Lắng nghe message từ VS Code
    window.addEventListener("message", handleMessage);

    // Request theme immediately on mount
    const vscode = (window as any).vscodeApi;
    if (vscode) {
      try {
        vscode.postMessage({ command: "requestTheme" });
      } catch (error) {
        console.error("[useVSCodeTheme] Failed to request theme:", error);
      }
    } else {
      console.warn("[useVSCodeTheme] vscodeApi not available");
    }

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  return { themeKind, themeId, themeVersion };
};
