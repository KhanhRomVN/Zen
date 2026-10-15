/**
 * ------------------------------------------------------------------
 * WaitingIndicator
 * ------------------------------------------------------------------
 * Hiển thị trạng thái "Waiting for response" trong giai đoạn từ lúc gửi
 * request đến khi nhận được chunk nội dung đầu tiên từ AI.
 * Sử dụng hiệu ứng sweep gradient trên text để tạo cảm giác loading nhẹ nhàng.
 * ------------------------------------------------------------------
 */

import React, { useEffect, useState } from "react";

interface WaitingIndicatorProps {
  /** Thời điểm bắt đầu đếm giây (timestamp ms) */
  startTime: number;
}

const WaitingIndicator: React.FC<WaitingIndicatorProps> = ({ startTime }) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    // Cập nhật số giây mỗi 100ms để mượt mà hơn
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setSeconds(elapsed);
    }, 100);

    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "8px 0",
        minHeight: "32px",
      }}
    >
      <span
        className="waiting-sweep-text"
        style={{
          fontSize: "14px",
          fontWeight: 500,
          color: "var(--vscode-descriptionForeground)",
          // Hiệu ứng sweep gradient
          background: "linear-gradient(90deg, var(--vscode-descriptionForeground) 0%, var(--vscode-editor-foreground) 50%, var(--vscode-descriptionForeground) 100%)",
          backgroundSize: "200% auto",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          animation: "sweepGradient 2s linear infinite",
        }}
      >
        Waiting for response for {seconds}s...
      </span>

      <style>{`
        @keyframes sweepGradient {
          to {
            background-position: 200% center;
          }
        }
      `}</style>
    </div>
  );
};

export default WaitingIndicator;