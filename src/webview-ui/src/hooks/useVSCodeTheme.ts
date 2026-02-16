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
    // Hàm xử lý message từ VS Code extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data as VSCodeThemeMessage;
      if (message.command === "updateTheme") {
        console.log("[useVSCodeTheme] Received updateTheme:", {
          theme: message.theme,
          hasTokenColors: !!message.tokenColors,
          colorCount: message.tokenColors
            ? Object.keys(message.tokenColors).length
            : 0,
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

  return { themeKind, tokenColors };
};
