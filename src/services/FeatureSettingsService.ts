/**
 * ------------------------------------------------------------------
 * Feature Settings Service
 * ------------------------------------------------------------------
 * Giữ trạng thái các cờ tính năng (checkpoint, diagnostics...) được
 * webview đồng bộ sang qua message "syncFeatureSettings". Vì
 * CheckpointManager và DiagnosticsService là các singleton độc lập
 * không có quyền truy cập storage của webview, service này đóng vai
 * trò nguồn chân lý dùng chung trong phiên làm việc hiện tại của
 * extension host. Mặc định bật (true) cho tới khi webview gửi giá
 * trị thật.
 *
 * Main functions:
 * - getInstance() : Lấy singleton instance
 * - sync()        : Cập nhật các cờ từ message webview gửi lên
 * ------------------------------------------------------------------
 */

export class FeatureSettingsService {
  private static instance: FeatureSettingsService;

  private _checkpointEnabled = true;
  private _diagnosticEnabled = true;

  public static getInstance(): FeatureSettingsService {
    if (!FeatureSettingsService.instance) {
      FeatureSettingsService.instance = new FeatureSettingsService();
    }
    return FeatureSettingsService.instance;
  }

  public get checkpointEnabled(): boolean {
    return this._checkpointEnabled;
  }

  public get diagnosticEnabled(): boolean {
    return this._diagnosticEnabled;
  }

  /** Cập nhật cờ từ message "syncFeatureSettings" do webview gửi. */
  public sync(settings: {
    checkpointEnabled?: boolean;
    diagnosticEnabled?: boolean;
  }) {
    if (typeof settings.checkpointEnabled === "boolean") {
      this._checkpointEnabled = settings.checkpointEnabled;
    }
    if (typeof settings.diagnosticEnabled === "boolean") {
      this._diagnosticEnabled = settings.diagnosticEnabled;
    }
  }
}