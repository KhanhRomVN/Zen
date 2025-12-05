import * as http from "http";
import * as WebSocket from "ws";
import type { WebSocket as WSWebSocket } from "ws";
import { GlobalStateManager, GlobalServerState } from "./GlobalStateManager";

export class SingletonWSManager {
  private static FIXED_PORT = 3000;
  private static instance: SingletonWSManager | null = null;

  private _wsServer?: WebSocket.Server;
  private _httpServer?: http.Server;
  private _clients: Set<WSWebSocket> = new Set();
  private _clientIsWebview: Map<WSWebSocket, boolean> = new Map();
  private _isServerOwner: boolean = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): SingletonWSManager {
    if (!SingletonWSManager.instance) {
      SingletonWSManager.instance = new SingletonWSManager();
    }
    return SingletonWSManager.instance;
  }

  /**
   * Initialize WebSocket server (singleton)
   */
  public async initialize(): Promise<number> {
    // Check if server already running
    const existingState = GlobalStateManager.readState();

    if (existingState) {
      console.log(
        `[SingletonWSManager] ✅ Server already running on port ${existingState.port}`
      );
      // Increment instance count
      GlobalStateManager.incrementInstanceCount();
      this._isServerOwner = false;
      return existingState.port;
    }

    // No existing server, create new one
    console.log(
      `[SingletonWSManager] 🚀 Starting new server on port ${SingletonWSManager.FIXED_PORT}`
    );

    try {
      await this.startServer();
      this._isServerOwner = true;

      // Save state
      const state: GlobalServerState = {
        port: SingletonWSManager.FIXED_PORT,
        pid: process.pid,
        timestamp: Date.now(),
        instanceCount: 1,
      };
      GlobalStateManager.writeState(state);

      return SingletonWSManager.FIXED_PORT;
    } catch (error) {
      console.error("[SingletonWSManager] ❌ Failed to start server:", error);
      throw error;
    }
  }

  /**
   * Start WebSocket server
   */
  private async startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._httpServer = http.createServer();

      this._httpServer.on("error", (error: any) => {
        if (error.code === "EADDRINUSE") {
          reject(new Error(`Port ${SingletonWSManager.FIXED_PORT} in use`));
        } else {
          reject(error);
        }
      });

      this._wsServer = new WebSocket.Server({ server: this._httpServer });

      this._wsServer.on("connection", (ws: WebSocket) => {
        this._clients.add(ws);
        const isWebviewClient = this._clients.size === 1;
        this._clientIsWebview.set(ws, isWebviewClient);

        // Send connection-established
        setTimeout(() => {
          if (ws.readyState === ws.OPEN) {
            ws.send(
              JSON.stringify({
                type: "connection-established",
                port: SingletonWSManager.FIXED_PORT,
              })
            );
          }
        }, 50);

        // PING mechanism
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
        }, 45000);

        ws.on("message", (message: string) => {
          this.handleMessage(message.toString(), ws, isWebviewClient);
        });

        ws.on("close", () => {
          const wasWebviewClient = this._clientIsWebview.get(ws) || false;
          this._clients.delete(ws);
          this._clientIsWebview.delete(ws);
          clearInterval(pingInterval);

          if (!wasWebviewClient) {
            this.broadcastToWebviews({
              type: "focusedTabsUpdate",
              data: [],
              timestamp: Date.now(),
            });
          }
        });

        ws.on("error", (error: Error) => {
          console.error("[SingletonWSManager] Client error:", error);
          clearInterval(pingInterval);
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
          res.end(
            JSON.stringify({
              status: "ok",
              port: SingletonWSManager.FIXED_PORT,
            })
          );
        } else {
          res.writeHead(404, headers);
          res.end();
        }
      });

      this._httpServer.listen(SingletonWSManager.FIXED_PORT, () => {
        console.log(
          `[SingletonWSManager] ✅ Server listening on port ${SingletonWSManager.FIXED_PORT}`
        );
        resolve();
      });
    });
  }

  /**
   * Handle WebSocket message
   */
  private handleMessage(
    message: string,
    ws: WebSocket,
    isWebviewClient: boolean
  ): void {
    try {
      const data = JSON.parse(message);

      if (data.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
      } else if (data.type === "pong") {
        // Do nothing
      } else if (data.type === "requestFocusedTabs") {
        this.broadcastToExternalClients({
          type: "requestFocusedTabs",
          timestamp: Date.now(),
        });
      } else if (data.type === "sendPrompt") {
        this.broadcastToExternalClients(data);
      } else if (data.type === "promptResponse" && !isWebviewClient) {
        this.broadcastToWebviews(data);
      } else if (data.type === "focusedTabsUpdate" && !isWebviewClient) {
        this.broadcastToAll(data);
      }
    } catch (error) {
      console.error("[SingletonWSManager] Error handling message:", error);
    }
  }

  /**
   * Broadcast to all clients
   */
  private broadcastToAll(data: any): void {
    const message = JSON.stringify(data);
    this._clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Broadcast to webview clients only
   */
  private broadcastToWebviews(data: any): void {
    const message = JSON.stringify(data);
    this._clients.forEach((client) => {
      if (
        client.readyState === WebSocket.OPEN &&
        this._clientIsWebview.get(client)
      ) {
        client.send(message);
      }
    });
  }

  /**
   * Broadcast to external clients (ZenTab) only
   */
  private broadcastToExternalClients(data: any): void {
    const message = JSON.stringify(data);
    this._clients.forEach((client) => {
      if (
        client.readyState === WebSocket.OPEN &&
        !this._clientIsWebview.get(client)
      ) {
        client.send(message);
      }
    });
  }

  /**
   * Stop WebSocket server
   */
  public async stop(): Promise<void> {
    // Decrement instance count
    const remainingInstances = GlobalStateManager.decrementInstanceCount();

    console.log(
      `[SingletonWSManager] Instance closing. Remaining: ${remainingInstances}`
    );

    // Only stop server if this is the owner AND no more instances
    if (this._isServerOwner && remainingInstances === 0) {
      console.log("[SingletonWSManager] 🛑 Stopping server (last instance)");

      return new Promise((resolve) => {
        let wsServerClosed = false;
        let httpServerClosed = false;
        let resolved = false;

        const checkBothClosed = () => {
          if (wsServerClosed && httpServerClosed && !resolved) {
            resolved = true;
            GlobalStateManager.clearState();
            setTimeout(() => resolve(), 200);
          }
        };

        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            GlobalStateManager.clearState();
            resolve();
          }
        }, 2000);

        if (this._wsServer) {
          this._wsServer.clients.forEach((client) => {
            this._clients.delete(client);
            client.close();
          });

          this._wsServer.close(() => {
            wsServerClosed = true;
            checkBothClosed();
          });
          this._wsServer = undefined;
        } else {
          wsServerClosed = true;
        }

        if (this._httpServer) {
          this._httpServer.close(() => {
            httpServerClosed = true;
            checkBothClosed();
          });
          this._httpServer = undefined;
        } else {
          httpServerClosed = true;
        }

        checkBothClosed();
      });
    } else {
      console.log(
        "[SingletonWSManager] ✅ Instance closed (server still running)"
      );
    }
  }

  /**
   * Get current port
   */
  public getPort(): number {
    return SingletonWSManager.FIXED_PORT;
  }
}
