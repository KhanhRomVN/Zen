import { useEffect, useState } from "react";

interface VSCodeThemeMessage {
  command: "updateTheme";
  theme: number; // vscode.ColorThemeKind: 1=Light, 2=Dark, 3=HighContrastLight, 4=HighContrastDark
  // Không còn cssVariables nữa vì VS Code tự động inject CSS variables
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

  useEffect(() => {
    // Hàm xử lý message từ VS Code extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data as VSCodeThemeMessage;
      if (message.command === "updateTheme") {
        setThemeKind(message.theme);

        // Không cần áp dụng CSS variables vì VS Code đã tự động inject
        // Các CSS variables có sẵn thông qua :root selector
      }
    };

    // Lắng nghe message từ VS Code
    window.addEventListener("message", handleMessage);

    // Không cần yêu cầu theme vì extension sẽ tự động gửi khi khởi tạo
    // Có thể gửi request nếu muốn
    const vscode = (window as any).vscodeApi;
    if (vscode) {
      try {
        vscode.postMessage({ command: "ready" });
      } catch (error) {
        // VS Code API not available in development
      }
    }

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  return { themeKind };
};
