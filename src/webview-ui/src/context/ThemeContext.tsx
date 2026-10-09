import React, { createContext, ReactNode } from "react";
import { useVSCodeTheme } from "../hooks/useVSCodeTheme";

interface ThemeContextType {
  // Fields reserved for future use or consumed by external consumers via context
  // Currently unused in this module's rendering logic
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const theme = useVSCodeTheme();

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
};