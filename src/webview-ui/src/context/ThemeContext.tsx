import React, { createContext, useContext, ReactNode } from "react";
import { useVSCodeTheme } from "../hooks/useVSCodeTheme";

interface ThemeContextType {
  themeKind: number;
  themeId?: string;
  themeVersion?: number;
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