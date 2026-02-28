import { useState, useEffect } from "react";

export const useNetworkPing = () => {
  const [ping, setPing] = useState<number | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === "networkPingUpdate") {
        setPing(message.ping);
      }
    };

    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
    };
  }, []);

  const getPingColor = () => {
    if (ping === null) return "var(--vscode-testing-iconUnset)"; // Grey
    if (ping < 100) return "#4caf50"; // Green
    if (ping < 300) return "#ffeb3b"; // Yellow
    if (ping < 600) return "#ff9800"; // Orange
    return "#f44336"; // Red
  };

  return { ping, color: getPingColor() };
};
