import * as vscode from "vscode";

/**
 *? Usage:
 *    Virtual document provider cho scheme `zen-diff://`. File qua scheme này không bị language server phân tích, tránh diagnostic giả khi mở diff editor.
 *
 *? Function:
 *    store()                  : Lưu nội dung vào store với key.
 *    toUri()                  : Tạo URI zen-diff:// từ key + basename.
 *    provideTextDocumentContent(): Trả về nội dung cho URI (theo authority).
 *    register()               : Đăng ký provider với extension context.
 */
export class DiffProvider implements vscode.TextDocumentContentProvider {
  static readonly SCHEME = "zen-diff";

  private static _instance: DiffProvider | undefined;
  private readonly _store = new Map<string, string>();

  private constructor() {}

  static get instance(): DiffProvider {
    if (!DiffProvider._instance) {
      DiffProvider._instance = new DiffProvider();
    }
    return DiffProvider._instance;
  }

  /**
   * Register this provider with the extension context.
   * Call once from `activate()`.
   */
  static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.workspace.registerTextDocumentContentProvider(
      DiffProvider.SCHEME,
      DiffProvider.instance,
    );
  }

  store(key: string, content: string): void {
    this._store.set(key, content);
  }

  static toUri(key: string, basename: string): vscode.Uri {
    return vscode.Uri.from({
      scheme: DiffProvider.SCHEME,
      authority: key,
      path: `/${basename}`,
    });
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    // The key is stored in the authority component of the URI
    const key = uri.authority;
    const content = this._store.get(key) ?? "";
    return content;
  }
}
