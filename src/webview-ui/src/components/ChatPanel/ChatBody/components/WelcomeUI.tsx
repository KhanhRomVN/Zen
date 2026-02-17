import React, { useState, useEffect } from "react";
import { Zap } from "lucide-react";

const SLOGANS = [
  "Feel Free Chat Free",
  "Chat Free With All Model In the World",
  "Limitless Intelligence, Zero Cost",
  "Powering Your Code with Global AI",
  "High-Performance Chat, Powered by Zen",
  "Your Gateway to All AI Models",
];

const WelcomeUI: React.FC = () => {
  const imagesUri = (window as any).__zenImagesUri;
  const [sloganIndex, setSloganIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSloganIndex((prev) => (prev + 1) % SLOGANS.length);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "100px 20px 20px 20px",
        color: "var(--primary-text)",
        animation: "fadeIn 0.5s ease-out",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "24px",
          textAlign: "center",
          maxWidth: "500px",
        }}
      >
        {/* Horizontal Header Section */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={`${imagesUri}/icon.png`}
              alt="Zen Logo"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />
          </div>

          <h1
            style={{
              fontSize: "36px",
              fontWeight: 800,
              margin: 0,
              background:
                "linear-gradient(to right, var(--primary-text), var(--secondary-text))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.02em",
            }}
          >
            Zen
          </h1>
        </div>

        {/* Dynamic Slogan Section */}
        <div
          style={{
            height: "40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            margin: "0 0 16px 0",
          }}
        >
          <div
            key={sloganIndex}
            style={{
              fontSize: "18px",
              color: "var(--secondary-text)",
              fontWeight: 500,
              animation: "slideUp 0.4s ease-out",
              whiteSpace: "nowrap",
            }}
          >
            {SLOGANS[sloganIndex]}
          </div>
        </div>

        {/* Elara Requirement Alert */}
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "12px",
            backgroundColor: "rgba(234, 179, 8, 0.05)",
            border: "1px solid rgba(234, 179, 8, 0.15)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            textAlign: "left",
            width: "100%",
          }}
        >
          <Zap size={20} color="#eab308" style={{ flexShrink: 0 }} />
          <div
            style={{
              fontSize: "12px",
              color: "var(--primary-text)",
              lineHeight: "1.4",
            }}
          >
            <strong style={{ color: "#eab308" }}>Prerequisite:</strong> This
            extension requires{" "}
            <a
              href="https://github.com/KhanhRomVN/Elara"
              target="_blank"
              style={{
                color: "var(--accent-color)",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Elara Backend
            </a>{" "}
            to function. Ensure it is running.
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default WelcomeUI;
