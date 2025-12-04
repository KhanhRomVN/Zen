import * as vscode from "vscode";

export class ZenChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "zen-chat";

  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, "src/webview-ui/dist"),
        vscode.Uri.joinPath(this._extensionUri, "src/webview-ui/public"),
      ],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Gửi theme colors ban đầu
    this._updateTheme(webviewView.webview);

    // Lắng nghe sự kiện thay đổi theme
    const themeChangeDisposable = vscode.window.onDidChangeActiveColorTheme(
      () => {
        this._updateTheme(webviewView.webview);
      }
    );

    // Thêm disposable vào context subscriptions nếu có (cho VS Code API tương thích)
    const ctx = context as any;
    if (ctx.subscriptions && Array.isArray(ctx.subscriptions)) {
      ctx.subscriptions.push(themeChangeDisposable);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "src/webview-ui/dist",
        "webview.js"
      )
    );
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
 <meta charset="UTF-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
 <title>Zen Chat
</title>
 <style>
 /* VS Code sẽ tự động inject CSS variables vào webview */
 /* Chúng ta sử dụng các variables này trực tiếp */
 :root {
 /* Map các variables custom của chúng ta sang VS Code variables */
 --primary-bg: var(--vscode-editor-background, #1e1e1e);
 --secondary-bg: var(--vscode-sideBar-background, #252526);
 --tertiary-bg: var(--vscode-panel-background, #2d2d30);
 --hover-bg: var(--vscode-list-hoverBackground, #2a2d2e);
 --primary-text: var(--vscode-foreground, #cccccc);
 --secondary-text: var(--vscode-descriptionForeground, #858585);
 --accent-text: var(--vscode-textLink-foreground, #4fc3f7);
 --border-color: var(--vscode-panel-border, #3e3e42);
 --input-bg: var(--vscode-input-background, #3c3c3c);
 --button-primary: var(--vscode-button-background, #0e639c);
 --button-primary-hover: var(--vscode-button-hoverBackground, #1177bb);
 --button-secondary: var(--vscode-button-secondaryBackground, var(--vscode-sideBar-background, #2d2d30));
 --button-secondary-hover: var(--vscode-button-secondaryHoverBackground, #3e3e42);
 }
 
</style>
</head>
<body>
 <div id="root">
</div>
 <script nonce="${nonce}" src="${scriptUri}">
</script>
</body>
</html>`;
  }

  private getNonce(): string {
    let text = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  private _updateTheme(webview: vscode.Webview) {
    // Lấy theme hiện tại
    const theme = vscode.window.activeColorTheme;
    const themeKind = theme.kind;

    // VS Code tự động inject CSS variables vào webview
    // Chúng ta chỉ cần gửi theme kind để webview biết loại theme nào đang được sử dụng
    webview.postMessage({
      command: "updateTheme",
      theme: themeKind,
    });
  }

  public postMessageToWebview(message: any) {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }
}

export function activate(context: vscode.ExtensionContext) {
  const provider = new ZenChatViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ZenChatViewProvider.viewType,
      provider
    )
  );

  const openChatCommand = vscode.commands.registerCommand(
    "zen.openChat",
    () => {
      vscode.commands.executeCommand("workbench.view.extension.zen-sidebar");
    }
  );

  const settingsCommand = vscode.commands.registerCommand(
    "zen.settings",
    () => {
      // Hiển thị thông báo tạm thời, sau này có thể mở settings panel
      vscode.window.showInformationMessage("Opening Zen settings...");
      // Gửi message đến webview để mở settings
      provider.postMessageToWebview({ command: "openSettings" });
    }
  );

  const historyCommand = vscode.commands.registerCommand("zen.history", () => {
    vscode.window.showInformationMessage("Opening chat history...");
    provider.postMessageToWebview({ command: "openHistory" });
  });

  const newChatCommand = vscode.commands.registerCommand("zen.newChat", () => {
    vscode.window.showInformationMessage("Creating new chat...");
    provider.postMessageToWebview({ command: "newChat" });
  });

  context.subscriptions.push(
    openChatCommand,
    settingsCommand,
    historyCommand,
    newChatCommand
  );
}

export function deactivate() {}
