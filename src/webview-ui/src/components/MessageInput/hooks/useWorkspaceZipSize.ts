import * as React from "react";
import { extensionService } from "@/services/ExtensionService";

export interface ZipSizeState {
  /** Kích thước file zip tính bằng bytes; null khi chưa có dữ liệu */
  sizeBytes: number | null;
  /** Số file được đưa vào zip */
  fileCount: number | null;
  /** Đang trong quá trình zip */
  isZipping: boolean;
  /** Lỗi từ bước zip (network, timeout, ...) */
  error: string | null;
}

const INITIAL_STATE: ZipSizeState = {
  sizeBytes: null,
  fileCount: null,
  isZipping: false,
  error: null,
};

/** Timeout ngắn hơn bản production (60s) để UI không bị treo lâu khi user đổi model liên tục */
const ZIP_TIMEOUT_MS = 30_000;
/** Debounce để tránh spam zip khi user rapid-switch giữa các model claude */
const DEBOUNCE_MS = 800;

interface RequestWorkspaceZipResult {
  base64: string;
  mimeType: string;
  fileName: string;
  fileCount: number;
  skippedCount: number;
  sizeBytes: number;
}

/**
 * Gọi command "zipWorkspace" tới extension host và đợi kết quả.
 * Chỉ giữ lại metadata nhẹ (size, fileCount) — discard base64 để tránh leak memory.
 */
const requestWorkspaceZipMeta = (): Promise<RequestWorkspaceZipResult | null> => {
  return new Promise((resolve) => {
    const requestId = `zip-badge-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const timer = setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve(null);
    }, ZIP_TIMEOUT_MS);

    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.command === "zipWorkspaceResult" && msg.requestId === requestId) {
        clearTimeout(timer);
        window.removeEventListener("message", handler);
        if (msg.error) {
          resolve(null);
        } else {
          resolve(msg.data);
        }
      }
    };

    window.addEventListener("message", handler);
    extensionService.postMessage({ command: "zipWorkspace", requestId });
  });
};

/**
 * Hook lấy kích thước ước lượng của workspace zip — dùng cho Claude provider badge.
 *
 * - Tự động trigger khi `enabled` chuyển true hoặc `triggerKey` thay đổi.
 * - Cache kết quả theo `triggerKey` để không zip lại khi user toggle qua lại.
 * - Debounce 800ms chống spam khi user rapid-switch model.
 *
 * @param enabled     Chỉ chạy khi provider hiện tại là claude
 * @param triggerKey  Giá trị đại diện cho "phiên zip" (vd: rootPath + modelName).
 *                    Đổi key → invalidate cache, chạy lại.
 */
export const useWorkspaceZipSize = (
  enabled: boolean,
  triggerKey: string | null,
): ZipSizeState => {
  const [state, setState] = React.useState<ZipSizeState>(INITIAL_STATE);
  // Cache theo triggerKey để lần sau mở lại không phải zip lại
  const cacheRef = React.useRef<Map<string, ZipSizeState>>(new Map());
  const abortTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightKeyRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    // Cleanup timer cũ mỗi khi effect re-run
    if (abortTimerRef.current !== null) {
      clearTimeout(abortTimerRef.current);
      abortTimerRef.current = null;
    }

    // Không enabled hoặc không có key → reset về idle
    if (!enabled || !triggerKey) {
      setState(INITIAL_STATE);
      inflightKeyRef.current = null;
      return;
    }

    // Hit cache → dùng ngay
    const cached = cacheRef.current.get(triggerKey);
    if (cached) {
      setState(cached);
      return;
    }

    // Đã có request đang chạy cho cùng key → bỏ qua, chờ kết quả
    if (inflightKeyRef.current === triggerKey) {
      return;
    }

    // Đánh dấu đang chạy, set state loading ngay để UI phản hồi tức thì
    inflightKeyRef.current = triggerKey;
    setState({ ...INITIAL_STATE, isZipping: true });

    abortTimerRef.current = setTimeout(async () => {
      try {
        const result = await requestWorkspaceZipMeta();
        // Nếu trong lúc chờ, key đã đổi (user switch model khác) → discard
        if (inflightKeyRef.current !== triggerKey) return;

        if (!result) {
          const errState: ZipSizeState = {
            sizeBytes: null,
            fileCount: null,
            isZipping: false,
            error: "Không lấy được thông tin workspace",
          };
          setState(errState);
          inflightKeyRef.current = null;
          return;
        }

        const okState: ZipSizeState = {
          sizeBytes: result.sizeBytes,
          fileCount: result.fileCount,
          isZipping: false,
          error: null,
        };
        cacheRef.current.set(triggerKey, okState);
        setState(okState);
        inflightKeyRef.current = null;
      } catch (err) {
        if (inflightKeyRef.current !== triggerKey) return;
        setState({
          sizeBytes: null,
          fileCount: null,
          isZipping: false,
          error: err instanceof Error ? err.message : String(err),
        });
        inflightKeyRef.current = null;
      }
    }, DEBOUNCE_MS);

    return () => {
      if (abortTimerRef.current !== null) {
        clearTimeout(abortTimerRef.current);
        abortTimerRef.current = null;
      }
    };
  }, [enabled, triggerKey]);

  return state;
};