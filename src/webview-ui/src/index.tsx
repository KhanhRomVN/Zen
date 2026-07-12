// IMPORTANT: WDYR must be imported before React
import "./wdyr";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";
import "./styles/variables.css";
import "./styles.css";

// Enable performance tracking for chat components (dev only)
import "./features/chat/components/performance-tracking";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);

root.render(<App />);
