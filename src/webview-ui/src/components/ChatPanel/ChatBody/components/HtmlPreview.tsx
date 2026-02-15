import React, { useRef, useEffect, useState } from "react";

interface HtmlPreviewProps {
  content: string;
}

const HtmlPreview: React.FC<HtmlPreviewProps> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.1); // Start small

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        // Calculate scale to fit 1920px into container width
        const newScale = containerWidth / 1920;
        setScale(newScale);
      }
    };

    // Initial calculation
    updateScale();

    // Observe resize
    const observer = new ResizeObserver(updateScale);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        aspectRatio: "16 / 9",
        overflow: "hidden",
        backgroundColor: "#1e1e1e", // Default background
        borderRadius: "var(--border-radius)",
        border: "1px solid var(--vscode-widget-border)",
        position: "relative",
      }}
    >
      <div
        style={{
          width: "1920px",
          height: "1080px",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "absolute",
          top: 0,
          left: 0,
          pointerEvents: "none", // Optional: prevent interaction if it's just a preview, or allow it? ALLOW for now.
        }}
      >
        <iframe
          srcDoc={`
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <style>
                  body { margin: 0; overflow: hidden; background-color: #fff; color: #000; height: 100vh; width: 100vw; }
                  /* Basic Reset */
                  * { box-sizing: border-box; }
                </style>
              </head>
              <body>
                ${content}
              </body>
            </html>
          `}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            pointerEvents: "auto", // Re-enable pointer events for the iframe content
          }}
          // Sandbox to prevent navigating the top frame or executing malicious scripts if user provided
          // sandbox="allow-scripts"
          // Note: "allow-scripts" needed for interactive UI
        />
      </div>
      {/* Overlay to intercept clicks if we want to block interaction, but user likely wants to see hover effects etc. 
          However, scaling might mess up mouse coordinates for interaction. 
          If pointer-events is auto on iframe, standard interactions should work but coordinates might be skewed depending on browser handling of transform on iframe parent?
          Actually, transform on parent USUALLY handles coordinate space correctly in modern browsers.
      */}
    </div>
  );
};

export default HtmlPreview;
