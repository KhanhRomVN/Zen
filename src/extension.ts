import * as vscode from "vscode";
import * as http from "http";
import * as WebSocket from "ws";

export class ZenChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "zen-chat";

  private _view?: vscode.WebviewView;
  private _wsPort: number = 0;
  private _wsServer?: WebSocket.Server;
  private _httpServer?: http.Server;

  constructor(private readonly _extensionUri: vscode.Uri) {
    this._wsPort = this.generateUniquePort();
    // Delay để đảm bảo server cũ đã cleanup
    setTimeout(() => {
      this.startWebSocketServer();
    }, 100);
  }

  private generateUniquePort(): number {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return 3000 + Math.floor(Math.random() * 1000);
    }

    const hash = workspaceFolder.uri.fsPath.split("").reduce((acc, char) => {
      return (acc << 5) - acc + char.charCodeAt(0);
    }, 0);

    return 3000 + Math.abs(hash % 7000);
  }

  private startWebSocketServer(): void {
    console.log(`[Zen] Starting WebSocket server on port ${this._wsPort}`);

    try {
      this._httpServer = http.createServer();
      this._httpServer.on("error", (error: any) => {
        if (error.code === "EADDRINUSE") {
          console.error(
            `[Zen] Port ${this._wsPort} already in use, will retry with new port...`
          );
          // Close current server nếu đang mở
          if (this._httpServer) {
            this._httpServer.close();
            this._httpServer = undefined;
          }
          if (this._wsServer) {
            this._wsServer.close();
            this._wsServer = undefined;
          }
          // Generate new port và retry
          this._wsPort = this.generateUniquePort();
          setTimeout(() => {
            this.startWebSocketServer();
          }, 200);
        } else {
          console.error("[Zen] HTTP server error:", error);
        }
      });

      this._wsServer = new WebSocket.Server({ server: this._httpServer });

      this._wsServer.on("connection", (ws: WebSocket) => {
        console.log(`[Zen] WebSocket client connected on port ${this._wsPort}`);

        // Delay sending connection-established để client có thời gian setup
        setTimeout(() => {
          if (ws.readyState === ws.OPEN) {
            ws.send(
              JSON.stringify({
                type: "connection-established",
                port: this._wsPort,
              })
            );
          }
        }, 50);

        ws.on("message", (message: string) => {
          console.log(`[Zen] Received message:`, message.toString());

          try {
            const data = JSON.parse(message.toString());
            this.handleWebSocketMessage(data, ws);
          } catch (error) {
            console.error("[Zen] Error parsing message:", error);
          }
        });

        ws.on("close", () => {
          console.log(`[Zen] WebSocket client disconnected`);
        });

        ws.on("error", (error: Error) => {
          console.error("[Zen] WebSocket error:", error);
        });
      });

      this._httpServer.on("request", (req, res) => {
        const headers = {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        };

        if (req.method === "OPTIONS") {
          res.writeHead(204, headers);
          res.end();
          return;
        }

        if (req.url === "/health") {
          res.writeHead(200, headers);
          res.end(JSON.stringify({ status: "ok", port: this._wsPort }));
        } else {
          res.writeHead(404, headers);
          res.end();
        }
      });

      this._httpServer.listen(this._wsPort, () => {
        console.log(`[Zen] WebSocket server started on port ${this._wsPort}`);
      });
    } catch (error) {
      console.error("[Zen] Failed to start WebSocket server:", error);
    }
  }

  private handleWebSocketMessage(data: any, ws: WebSocket): void {
    if (data.type === "ping") {
      ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
    } else if (data.type === "prompt") {
      console.log(`[Zen] Received prompt:`, data.content);
      ws.send(
        JSON.stringify({
          type: "response",
          content: "Message received",
          timestamp: Date.now(),
        })
      );
    }
  }

  public stopWebSocketServer(): Promise<void> {
    return new Promise((resolve) => {
      const oldPort = this._wsPort;
      let wsServerClosed = false;
      let httpServerClosed = false;
      let resolved = false;

      const checkBothClosed = () => {
        if (wsServerClosed && httpServerClosed && !resolved) {
          resolved = true;
          console.log(`[Zen] All servers stopped on port ${oldPort}`);
          // Add extra delay to ensure port is fully released
          setTimeout(() => {
            console.log(`[Zen] Port ${oldPort} cleanup complete`);
            resolve();
          }, 200);
        }
      };

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.log(
            `[Zen] Server stop timeout, forcing resolve on port ${oldPort}`
          );
          resolve();
        }
      }, 2000);

      if (this._wsServer) {
        // Close all active connections first
        this._wsServer.clients.forEach((client) => {
          console.log(
            `[Zen] Closing active WebSocket client on port ${oldPort}`
          );
          client.close();
        });

        this._wsServer.close((err) => {
          if (err) {
            console.error(
              `[Zen] Error closing WebSocket server on port ${oldPort}:`,
              err
            );
          } else {
            console.log(`[Zen] WebSocket server stopped on port ${oldPort}`);
          }
          wsServerClosed = true;
          checkBothClosed();
        });
        this._wsServer = undefined;
      } else {
        wsServerClosed = true;
      }

      if (this._httpServer) {
        this._httpServer.close((err) => {
          if (err) {
            console.error(
              `[Zen] Error closing HTTP server on port ${oldPort}:`,
              err
            );
          } else {
            console.log(`[Zen] HTTP server stopped on port ${oldPort}`);
          }
          httpServerClosed = true;
          checkBothClosed();
        });
        this._httpServer = undefined;
      } else {
        httpServerClosed = true;
      }

      checkBothClosed();
    });
  }

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

    this._updateTheme(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message) => {
      if (message.command === "getWorkspacePort") {
        console.log(`[Zen] Sending workspace port to webview: ${this._wsPort}`);
        webviewView.webview.postMessage({
          command: "workspacePort",
          port: this._wsPort,
        });
      } else if (message.command === "restartServer") {
        console.log(`[Zen] Restarting server - stopping old server first...`);

        this.stopWebSocketServer()
          .then(() => {
            console.log(
              `[Zen] Old server fully stopped, generating new port...`
            );
            this._wsPort = this.generateUniquePort();
            console.log(`[Zen] New port generated: ${this._wsPort}`);

            // Start new server
            this.startWebSocketServer();

            // Wait for server to be ready before sending port to client
            return new Promise<void>((resolve) => {
              let resolved = false;

              // Check if server is listening
              const checkInterval = setInterval(() => {
                if (this._httpServer && this._httpServer.listening) {
                  clearInterval(checkInterval);
                  if (!resolved) {
                    resolved = true;
                    console.log(
                      `[Zen] New server confirmed listening on port ${this._wsPort}`
                    );
                    resolve();
                  }
                }
              }, 50);

              // Timeout after 2 seconds
              const timeoutId = setTimeout(() => {
                clearInterval(checkInterval);
                if (!resolved) {
                  resolved = true;
                  console.log(
                    `[Zen] Server start timeout, sending port anyway`
                  );
                  resolve();
                }
              }, 2000);
            });
          })
          .then(() => {
            console.log(`[Zen] Sending new port ${this._wsPort} to webview`);
            webviewView.webview.postMessage({
              command: "workspacePort",
              port: this._wsPort,
            });
          })
          .catch((error) => {
            console.error(`[Zen] Error during server restart:`, error);
          });
      }
    });

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
 <meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src http://localhost:* ws://localhost:*; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
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

let activeProvider: ZenChatViewProvider | null = null;

export function activate(context: vscode.ExtensionContext) {
  const provider = new ZenChatViewProvider(context.extensionUri);
  activeProvider = provider;

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
      provider.postMessageToWebview({ command: "showSettings" });
    }
  );

  const historyCommand = vscode.commands.registerCommand("zen.history", () => {
    provider.postMessageToWebview({ command: "showHistory" });
  });

  const newChatCommand = vscode.commands.registerCommand("zen.newChat", () => {
    provider.postMessageToWebview({ command: "newChat" });
  });

  context.subscriptions.push(
    openChatCommand,
    settingsCommand,
    historyCommand,
    newChatCommand
  );
}

export function deactivate() {
  console.log("[Zen] Extension deactivating, stopping all servers...");
  if (activeProvider) {
    return activeProvider.stopWebSocketServer().then(() => {
      console.log("[Zen] All servers stopped during deactivation");
      activeProvider = null;
    });
  }
}
