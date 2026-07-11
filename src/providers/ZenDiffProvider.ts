import * as vscode from "vscode";

/**
 * ZenDiffProvider — a virtual document provider for the `zen-diff://` scheme.
 *
 * Files served under this scheme are NOT treated as workspace source files by
 * VSCode's language servers (TypeScript, ESLint, etc.), so they never produce
 * spurious diagnostics in the Problems panel when opened in a diff editor.
 *
 * Usage:
 *   ZenDiffProvider.instance.store(key, content);
 *   const uri = ZenDiffProvider.toUri(key, "MyFile.tsx");
 *   // pass uri to vscode.diff — no file is written to disk
 */
export class ZenDiffProvider implements vscode.TextDocumentContentProvider {
  static readonly SCHEME = "zen-diff";

  private static _instance: ZenDiffProvider | undefined;
  private readonly _store = new Map<string, string>();

  private constructor() {}

  static get instance(): ZenDiffProvider {
    if (!ZenDiffProvider._instance) {
      ZenDiffProvider._instance = new ZenDiffProvider();
    }
    return ZenDiffProvider._instance;
  }

  /**
   * Register this provider with the extension context.
   * Call once from `activate()`.
   */
  static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.workspace.registerTextDocumentContentProvider(
      ZenDiffProvider.SCHEME,
      ZenDiffProvider.instance,
    );
  }

  /**
   * Store content under a key so it can be retrieved when VSCode opens the URI.
   * @param key   Unique identifier (e.g. `${safeId}_before`)
   * @param content  Raw text content
   */
  store(key: string, content: string): void {
    this._store.set(key, content);
  }

  /**
   * Build a `zen-diff://` URI that encodes the key and preserves the original
   * filename (with its extension) so VSCode applies the correct syntax highlighting.
   *
   * URI shape:  zen-diff://<key>/<basename>
   *   e.g.      zen-diff://abc123_before/MyComponent.tsx
   */
  static toUri(key: string, basename: string): vscode.Uri {
    return vscode.Uri.from({
      scheme: ZenDiffProvider.SCHEME,
      authority: key,
      path: `/${basename}`,
    });
  }

  // ── TextDocumentContentProvider implementation ────────────────────────────

  provideTextDocumentContent(uri: vscode.Uri): string {
    // The key is stored in the authority component of the URI
    const key = uri.authority;
    const content = this._store.get(key) ?? "";
    return content;
  }
}
