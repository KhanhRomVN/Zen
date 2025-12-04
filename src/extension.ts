import * as vscode from "vscode";
import * as http from "http";
import * as WebSocket from "ws";
import type { WebSocket as WSWebSocket } from "ws";

export class ZenChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "zen-chat";

  private _view?: vscode.WebviewView;
  private _wsPort: number = 0;
  private _wsServer?: WebSocket.Server;
  private _httpServer?: http.Server;
  private _clientCount: number = 0;
  private _clients: Set<WSWebSocket> = new Set();
  private _clientIsWebview: Map<WSWebSocket, boolean> = new Map(); // 🆕 Track client type

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
    try {
      this._httpServer = http.createServer();
      this._httpServer.on("error", (error: any) => {
        if (error.code === "EADDRINUSE") {
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
        }
      });

      this._wsServer = new WebSocket.Server({ server: this._httpServer });

      this._wsServer.on("connection", (ws: WebSocket) => {
        this._clientCount++;
        this._clients.add(ws);
        const isWebviewClient = this._clientCount === 1; // Client đầu tiên là webview
        this._clientIsWebview.set(ws, isWebviewClient);

        console.log(
          `[WebSocket] New connection, total clients: ${this._clientCount}, isWebviewClient: ${isWebviewClient}`
        );

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

        // 🆕 PING MECHANISM: Gửi ping mỗi 45s để duy trì connection
        const pingInterval = setInterval(() => {
          if (ws.readyState === ws.OPEN) {
            ws.send(
              JSON.stringify({
                type: "ping",
                timestamp: Date.now(),
              })
            );
          } else {
            clearInterval(pingInterval);
          }
        }, 45000); // 45 seconds

        ws.on("message", (message: string) => {
          const messageStr = message.toString();

          try {
            const data = JSON.parse(messageStr);
            this.handleWebSocketMessage(data, ws, isWebviewClient);
          } catch (error) {
            // Error parsing message
          }
        });

        ws.on("close", () => {
          const wasWebviewClient = this._clientIsWebview.get(ws) || false;
          console.log(
            `[WebSocket] Client closed, wasWebviewClient: ${wasWebviewClient}, remaining clients: ${
              this._clients.size - 1
            }`
          );

          this._clientCount--;
          this._clients.delete(ws);
          this._clientIsWebview.delete(ws);
          clearInterval(pingInterval); // 🆕 Cleanup interval khi connection đóng

          // 🆕 CRITICAL: Nếu client ngắt là external client (ZenTab), gửi disconnect signal đến webview
          if (!wasWebviewClient) {
            console.log(
              `[WebSocket] External client disconnected, sending disconnect signal to remaining ${this._clients.size} clients`
            );

            const disconnectMessage = JSON.stringify({
              type: "focusedTabsUpdate",
              data: [], // 🆕 EMPTY array = disconnect signal
              timestamp: Date.now(),
            });

            this._clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(disconnectMessage);
              }
            });
          }
        });

        ws.on("error", (error: Error) => {
          const wasWebviewClient = this._clientIsWebview.get(ws) || false;
          console.error(
            `[WebSocket] Client error, wasWebviewClient: ${wasWebviewClient}`,
            error
          );

          clearInterval(pingInterval); // 🆕 Cleanup interval khi có lỗi

          // 🆕 Cũng gửi disconnect signal nếu là external client
          if (!wasWebviewClient && this._clients.has(ws)) {
            console.log(
              `[WebSocket] External client error, sending disconnect signal`
            );

            const disconnectMessage = JSON.stringify({
              type: "focusedTabsUpdate",
              data: [],
              timestamp: Date.now(),
            });

            this._clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN && client !== ws) {
                client.send(disconnectMessage);
              }
            });
          }
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
        // WebSocket server started
      });
    } catch (error) {
      // Failed to start WebSocket server
    }
  }

  private handleWebSocketMessage(
    data: any,
    ws: WebSocket,
    isWebviewClient: boolean
  ): void {
    console.log(
      `[WebSocket] Handling message type: ${data.type}, fromWebviewClient: ${isWebviewClient}`
    );

    if (data.type === "ping") {
      console.log(`[WebSocket] Received PING from client, sending PONG`);
      ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
    } else if (data.type === "pong") {
      console.log(`[WebSocket] Received PONG from client, connection alive`);
      // 🆕 PONG RESPONSE: ZenTab đã reply pong - connection vẫn alive
    } else if (data.type === "prompt") {
      ws.send(
        JSON.stringify({
          type: "response",
          content: "Message received",
          timestamp: Date.now(),
        })
      );
    } else if (data.type === "sendPrompt") {
      // 🆕 HANDLE sendPrompt từ webview - broadcast đến ZenTab
      console.log(`[WebSocket] 📤 Broadcasting sendPrompt to external clients`);
      const messageStr = JSON.stringify(data);
      this._clients.forEach((client: WSWebSocket) => {
        // Chỉ gửi đến external clients (không phải webview)
        if (
          client.readyState === WebSocket.OPEN &&
          !this._clientIsWebview.get(client)
        ) {
          client.send(messageStr);
        }
      });
    } else if (data.type === "promptResponse" && !isWebviewClient) {
      // 🆕 HANDLE promptResponse từ ZenTab - forward đến webview
      console.log(
        `[WebSocket] 📥 Forwarding promptResponse to webview clients`
      );
      const messageStr = JSON.stringify(data);
      this._clients.forEach((client: WSWebSocket) => {
        // Chỉ gửi đến webview clients
        if (
          client.readyState === WebSocket.OPEN &&
          this._clientIsWebview.get(client)
        ) {
          client.send(messageStr);
        }
      });
    } else if (data.type === "focusedTabsUpdate" && !isWebviewClient) {
      // Broadcast message từ external client đến TẤT CẢ clients
      const messageStr = JSON.stringify(data);
      this._clients.forEach((client: WSWebSocket) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(messageStr);
        }
      });
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
          // Add extra delay to ensure port is fully released
          setTimeout(() => {
            resolve();
          }, 200);
        }
      };

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, 2000);

      if (this._wsServer) {
        // Close all active connections first
        this._wsServer.clients.forEach((client) => {
          // Không log cho từng client khi stop server
          this._clients.delete(client);
          client.close();
        });

        this._wsServer.close((err) => {
          wsServerClosed = true;
          checkBothClosed();
        });
        this._wsServer = undefined;
      } else {
        wsServerClosed = true;
      }

      if (this._httpServer) {
        this._httpServer.close((err) => {
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
        webviewView.webview.postMessage({
          command: "workspacePort",
          port: this._wsPort,
        });
      } else if (message.command === "restartServer") {
        this.stopWebSocketServer()
          .then(() => {
            this._wsPort = this.generateUniquePort();

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
                    resolve();
                  }
                }
              }, 50);

              // Timeout after 2 seconds
              const timeoutId = setTimeout(() => {
                clearInterval(checkInterval);
                if (!resolved) {
                  resolved = true;
                  resolve();
                }
              }, 2000);
            });
          })
          .then(() => {
            webviewView.webview.postMessage({
              command: "workspacePort",
              port: this._wsPort,
            });
          })
          .catch((error) => {
            // Error during server restart
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
  if (activeProvider) {
    return activeProvider.stopWebSocketServer().then(() => {
      activeProvider = null;
    });
  }
}
