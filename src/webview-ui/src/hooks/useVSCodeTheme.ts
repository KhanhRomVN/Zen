import { useEffect, useState } from "react";

interface VSCodeThemeMessage {
  command: "updateTheme";
  theme: number; // vscode.ColorThemeKind: 1=Light, 2=Dark, 3=HighContrastLight, 4=HighContrastDark
  tokenColors?: {
    // Keywords
    keyword: string;
    keywordControl: string;
    keywordOperator: string;

    // Storage/Types
    storageType: string;

    // Functions
    entityNameFunction: string;
    metaFunctionCall: string;

    // Types/Classes
    entityNameType: string;
    entityNameClass: string;
    supportType: string;
    supportClass: string;

    // Variables
    variable: string;
    variableParameter: string;

    // Strings
    string: string;
    stringEscape: string;

    // Comments
    comment: string;

    // Numbers
    number: string;

    // Constants
    constant: string;

    // Punctuation
    punctuation: string;
  };
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
  const [tokenColors, setTokenColors] = useState<any>(null);

  useEffect(() => {
    console.log("[useVSCodeTheme] Hook mounted, setting up message listener");

    // Hàm xử lý message từ VS Code extension
    const handleMessage = (event: MessageEvent) => {
      console.log("[useVSCodeTheme] Received message:", event.data);
      const message = event.data as VSCodeThemeMessage;
      if (message.command === "updateTheme") {
        console.log("[useVSCodeTheme] Received theme update:", {
          themeKind: message.theme,
          tokenColors: message.tokenColors,
        });

        setThemeKind(message.theme);

        // Nhận token colors từ extension
        if (message.tokenColors) {
          setTokenColors(message.tokenColors);
        }
      }
    };

    // Lắng nghe message từ VS Code
    window.addEventListener("message", handleMessage);
    console.log("[useVSCodeTheme] Message listener added");

    // Request theme immediately on mount
    const vscode = (window as any).vscodeApi;
    if (vscode) {
      console.log("[useVSCodeTheme] Requesting theme from extension");
      try {
        vscode.postMessage({ command: "requestTheme" });
      } catch (error) {
        console.error("[useVSCodeTheme] Failed to request theme:", error);
      }
    } else {
      console.warn("[useVSCodeTheme] vscodeApi not available");
    }

    return () => {
      console.log("[useVSCodeTheme] Cleaning up message listener");
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  return { themeKind, tokenColors };
};
