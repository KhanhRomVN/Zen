import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import * as net from "net";
import { spawn } from "child_process";

const SOCKET_PATH = path.join(os.homedir(), "khanhromvn-zen", "bridge.sock");

class ZenPTY implements vscode.Pseudoterminal {
  public writeEmitter = new vscode.EventEmitter<string>();
  onDidWrite: vscode.Event<string> = this.writeEmitter.event;
  public closeEmitter = new vscode.EventEmitter<number>();
  onDidClose: vscode.Event<number> = this.closeEmitter.event;

  public accumulatedOutput = "";
  public isExecuting = false;
  public currentCwd: string;
  public isPersistent: boolean = false;
  public startTime: number = Date.now();
  public shellPath: string = "";
  public activeActionId: string | null = null;
  public lastOutputIndex: number = 0;
  public lastBusyStatus: boolean = false;
  public lastCommandText: string | null = null;
  public attachedToVSCode: boolean = false;
  public currentInputBuffer: string = "";
  public logFilePath: string = "";
  private logCurrentSizeBytes: number = 0;
  private readonly MAX_LOG_SIZE = 5 * 1024 * 1024; // 5 MB

  public commandStartEmitter = new vscode.EventEmitter<void>();
  onCommandStart: vscode.Event<void> = this.commandStartEmitter.event;

  public bridgeClient: BridgeClient | null = null;
  public terminalId: string;

  constructor(cwd: string, logFilePath: string, terminalId: string) {
    this.currentCwd = cwd;
    this.logFilePath = logFilePath;
    this.terminalId = terminalId;
    // Initialize file size if it exists
    if (fs.existsSync(this.logFilePath)) {
      try {
        const stats = fs.statSync(this.logFilePath);
        this.logCurrentSizeBytes = stats.size;

        // Load initial content for VS Code to show upon re-attach
        this.accumulatedOutput = fs.readFileSync(this.logFilePath, "utf8");
      } catch (e) {
        console.error("Failed to read existing terminal log", e);
      }
    } else {
      try {
        fs.mkdirSync(path.dirname(this.logFilePath), { recursive: true });
        fs.writeFileSync(this.logFilePath, "");
      } catch (e) {
        console.error("Failed to create terminal log directory", e);
      }
    }
  }

  open(): void {
    if (this.accumulatedOutput) {
      setTimeout(() => {
        this.writeEmitter.fire(this.accumulatedOutput);
      }, 50);
    }
  }
  close(): void {
    this.attachedToVSCode = false;
  }

  handleInput(data: string): void {
    if (this.bridgeClient) {
      this.bridgeClient.send({ type: "input", id: this.terminalId, data });
    }

    // Only track manual input if no tool action is currently active
    if (!this.activeActionId) {
      // Strip ANSI escape sequences (including bracketed paste markers like [200~)
      // before processing to prevent them from entering the command buffer.
      const cleanData = data.replace(/\x1B\[[0-9;?]*[a-zA-Z~]/g, "");

      // Handle the data character by character or as a block
      for (const char of cleanData) {
        if (char === "\r" || char === "\n") {
          if (this.currentInputBuffer.trim()) {
            this.lastCommandText = this.currentInputBuffer.trim();
            this.commandStartEmitter.fire();
          }
          this.currentInputBuffer = "";
        } else if (char === "\x7f" || char === "\b") {
          // Backspace
          this.currentInputBuffer = this.currentInputBuffer.slice(0, -1);
        } else if (char === "\u0003") {
          // Ctrl+C
          this.currentInputBuffer = "";
          this.lastCommandText = null;
        } else if (char.charCodeAt(0) >= 32) {
          // Regular printable character
          this.currentInputBuffer += char;
        }
      }
    }
  }

  updateTitle(title: string) {
    // Xterm sequence to update terminal title
    this.writeEmitter.fire(`\x1b]0;${title}\x07`);
  }

  stop() {
    if (this.bridgeClient) {
      this.bridgeClient.send({ type: "close", id: this.terminalId });
      this.isExecuting = false;
    }
  }

  terminate() {
    this.stop();
  }

  resetOutput() {
    this.accumulatedOutput = "";
    this.lastOutputIndex = 0;
  }

  public appendLog(data: string) {
    if (!this.logFilePath) return;

    try {
      const dataBuffer = Buffer.from(data, "utf8");
      this.logCurrentSizeBytes += dataBuffer.length;

      // Rotate if it exceeds MAX_LOG_SIZE
      if (this.logCurrentSizeBytes > this.MAX_LOG_SIZE) {
        let content = fs.readFileSync(this.logFilePath, "utf8");
        content += data;

        // Keep only second half (approx 2.5MB)
        const halfSize = Math.floor(this.MAX_LOG_SIZE / 2);
        const newContent = content.substring(content.length - halfSize);

        fs.writeFileSync(this.logFilePath, newContent, "utf8");
        this.logCurrentSizeBytes = Buffer.byteLength(newContent, "utf8");

        // Reset accumulatedOutput for UI so it doesn't grow huge in memory either
        // Only keep the same tail
        if (this.accumulatedOutput.length > halfSize) {
          this.accumulatedOutput = this.accumulatedOutput.substring(
            this.accumulatedOutput.length - halfSize,
          );
          this.lastOutputIndex = Math.min(
            this.lastOutputIndex,
            this.accumulatedOutput.length,
          );
        }
      } else {
        fs.appendFileSync(this.logFilePath, data, "utf8");
      }
    } catch (e) {
      console.error("Failed to append terminal log", e);
    }
  }

  public _triggerCommandFinished(output: string) {
    // This is a hacky way to get back to ProcessManager
    // In a cleaner design, we'd use events.
  }
}

class BridgeClient {
  private socket: net.Socket | null = null;
  private ptyMap = new Map<string, ZenPTY>();
  private isConnecting = false;
  private bridgeProcess: any = null;
  private messageQueue: any[] = [];

  constructor(
    private onTerminalsChanged: () => void,
    private onStatusChange: (id: string, status: "busy" | "free") => void,
  ) {}

  public registerPTY(id: string, pty: ZenPTY) {
    this.ptyMap.set(id, pty);
    pty.bridgeClient = this;
  }

  public async connect(): Promise<boolean> {
    if (this.socket && !this.socket.destroyed) return true;
    if (this.isConnecting) return false;

    this.isConnecting = true;
    return new Promise((resolve) => {
      const client = net.createConnection(SOCKET_PATH, () => {
        console.log("Connected to Terminal Bridge");
        this.socket = client;
        this.isConnecting = false;
        this.drainQueue();
        resolve(true);
      });

      client.on("data", (chunk) => {
        const lines = chunk
          .toString()
          .split("\n")
          .filter((l) => l.trim());
        for (const line of lines) {
          try {
            const msg = JSON.parse(line);
            this.handleMessage(msg);
          } catch (e) {}
        }
      });

      client.on("error", async (err) => {
        if (
          (err as any).code === "ENOENT" ||
          (err as any).code === "ECONNREFUSED"
        ) {
          console.log("Bridge not found, spawning...");
          const spawned = await this.spawnBridge();
          if (spawned) {
            // Retry connect once after spawn
            setTimeout(() => {
              this.isConnecting = false;
              this.connect().then(resolve);
            }, 600);
            return;
          }
        }
        this.isConnecting = false;
        resolve(false);
      });

      client.on("close", () => {
        this.socket = null;
        this.isConnecting = false;
      });
    });
  }

  private async spawnBridge(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const bridgeScript = path.join(__dirname, "TerminalBridge.js");
        this.bridgeProcess = spawn("node", [bridgeScript], {
          detached: true,
          stdio: "ignore",
        });
        this.bridgeProcess.unref();
        resolve(true);
      } catch (e) {
        console.error("Failed to spawn bridge", e);
        resolve(false);
      }
    });
  }

  public send(msg: any) {
    if (this.socket && this.socket.writable) {
      this.socket.write(JSON.stringify(msg) + "\n");
    } else {
      this.messageQueue.push(msg);
      if (!this.isConnecting) {
        this.connect();
      }
    }
  }

  private drainQueue() {
    if (!this.socket || !this.socket.writable) return;
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      this.socket.write(JSON.stringify(msg) + "\n");
    }
  }

  private handleMessage(msg: any) {
    const { type, id } = msg;
    const pty = this.ptyMap.get(id);
    if (!pty) return;

    if (type === "output") {
      pty.accumulatedOutput += msg.data;
      pty.writeEmitter.fire(msg.data);
      pty.appendLog(msg.data);

      // Look for markers in the accumulated output string from the last index
      if (pty.activeActionId) {
        const currentOutput = pty.accumulatedOutput.substring(
          pty.lastOutputIndex,
        );
        const endMarker = `ZEN_CMD_END: ${pty.activeActionId}`;
        const endIdx = currentOutput.indexOf(endMarker);

        if (endIdx !== -1) {
          pty._triggerCommandFinished(currentOutput);
          pty.activeActionId = null;
          pty.lastCommandText = null;
          pty.lastOutputIndex = pty.accumulatedOutput.length;
        }
      }
      this.onTerminalsChanged();
    } else if (type === "status" || type === "list") {
      let anyChanged = false;
      const termInfoList = type === "status" ? [msg] : msg.terminals;

      for (const termInfo of termInfoList) {
        const pty = this.ptyMap.get(termInfo.id);
        if (pty) {
          if (pty.currentCwd !== termInfo.cwd) {
            pty.currentCwd = termInfo.cwd;
            anyChanged = true;
          }

          let isBusy = termInfo.isBusy;
          if (pty.activeActionId) isBusy = true;

          if (pty.lastBusyStatus !== isBusy) {
            pty.lastBusyStatus = isBusy;
            anyChanged = true;

            // Clear command text when it becomes idle
            if (!isBusy) {
              pty.lastCommandText = null;
              pty.currentInputBuffer = "";
            }

            this.onStatusChange(termInfo.id, isBusy ? "busy" : "free");
          } else if (!isBusy && pty.lastCommandText) {
            // Safety: if it's already idle but command text somehow remained
            pty.lastCommandText = null;
            anyChanged = true;
          }
        }
      }
      if (anyChanged) {
        this.onTerminalsChanged();
      }
    } else if (type === "exit") {
      pty.closeEmitter.fire(msg.exitCode);
      this.onTerminalsChanged();
    }
  }
}

export class ProcessManager {
  private terminalMap = new Map<
    string,
    {
      terminal: vscode.Terminal | null; // Changed to allow null for detached terminals
      pty: ZenPTY;
      name: string;
    }
  >();
  private bridgeClient: BridgeClient;
  private onTerminalsChangedEmitter = new vscode.EventEmitter<void>();
  public onTerminalsChanged = this.onTerminalsChangedEmitter.event;

  private onCommandFinishedEmitter = new vscode.EventEmitter<{
    actionId: string;
    output: string;
    terminalId: string;
    commandText?: string;
  }>();
  public onCommandFinished = this.onCommandFinishedEmitter.event;

  private onDidWriteDataEmitter = new vscode.EventEmitter<{
    terminalId: string;
    data: string;
  }>();
  public onDidWriteData = this.onDidWriteDataEmitter.event;

  private onTerminalStatusChangedEmitter = new vscode.EventEmitter<{
    terminalId: string;
    status: "busy" | "free";
  }>();
  public onTerminalStatusChanged = this.onTerminalStatusChangedEmitter.event;

  private _extensionContext: vscode.ExtensionContext | null = null;
  private readonly STORAGE_KEY = "zen.persistentTerminals";

  private getTerminalLogsDir(): string {
    return path.join(os.homedir(), "khanhromvn-zen", "terminals");
  }

  constructor() {
    this.bridgeClient = new BridgeClient(
      () => this.onTerminalsChangedEmitter.fire(),
      (id, status) =>
        this.onTerminalStatusChangedEmitter.fire({ terminalId: id, status }),
    );

    vscode.window.onDidCloseTerminal((terminal) => {
      let foundId: string | null = null;
      for (const [id, entry] of this.terminalMap.entries()) {
        if (entry.terminal === terminal) {
          entry.pty.attachedToVSCode = false;
          entry.terminal = null as any;
          foundId = id;
          break;
        }
      }
      if (foundId) {
        this.saveState();
        this.onTerminalsChangedEmitter.fire();
      }
    });

    // Auto-refresh terminal states and titles every 1 second (faster detection)
    setInterval(() => {
      this.updateTerminalStates();
    }, 1000);
  }

  private updateTerminalStates() {
    this.bridgeClient.send({ type: "list" });
  }

  public setExtensionContext(context: vscode.ExtensionContext) {
    this._extensionContext = context;
  }

  private saveState() {
    if (!this._extensionContext) return;

    try {
      const stateToSave = Array.from(this.terminalMap.entries()).map(
        ([id, entry]) => {
          return {
            id,
            name: entry.name,
            cwd: entry.pty.currentCwd,
            shellPath: entry.pty.shellPath,
            lastCommandText: entry.pty.lastCommandText,
            isAttached: entry.pty.attachedToVSCode,
          };
        },
      );

      this._extensionContext.workspaceState.update(
        this.STORAGE_KEY,
        stateToSave,
      );
    } catch (e) {
      console.error("Failed to save terminal state", e);
    }
  }

  public restoreState() {
    if (!this._extensionContext) return;

    try {
      const savedTerminals = this._extensionContext.workspaceState.get<
        {
          id: string;
          name: string;
          cwd: string;
          shellPath: string;
        }[]
      >(this.STORAGE_KEY, []);

      for (const t of savedTerminals) {
        // Prevent restoring duplicates
        if (!this.terminalMap.has(t.id)) {
          this.startInteractive(t.cwd, t.id, t.shellPath, t.name);
          const entry = this.terminalMap.get(t.id);
          if (entry) {
            if ((t as any).lastCommandText) {
              entry.pty.lastCommandText = (t as any).lastCommandText;
            }
            // Auto re-attach if it was previously attached
            if ((t as any).isAttached) {
              this.attachToVSCode(t.id);
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to restore terminal state", e);
    }
  }

  async startInteractive(
    cwd: string,
    terminalId?: string,
    overrideShellPath?: string,
    overrideName?: string,
  ): Promise<{ id: string; name: string }> {
    const id = terminalId || crypto.randomUUID();
    let entry = this.terminalMap.get(id);

    if (!entry) {
      const shell =
        overrideShellPath ||
        (os.platform() === "win32"
          ? "powershell.exe"
          : process.env.SHELL || "/bin/bash");
      const args = os.platform() === "win32" ? [] : ["-li"];
      const shellName = path.basename(shell);
      const name = overrideName || `(zen)${shellName}`;
      const logFilePath = path.join(this.getTerminalLogsDir(), `${id}.log`);
      const ptyInternal = new ZenPTY(cwd, logFilePath, id);

      (ptyInternal as any)._triggerCommandFinished = (output: string) => {
        this.onCommandFinishedEmitter.fire({
          actionId: ptyInternal.activeActionId!,
          output: output,
          terminalId: id,
          commandText: ptyInternal.lastCommandText || undefined,
        });
      };
      ptyInternal.isPersistent = true;
      ptyInternal.shellPath = shell;
      this.bridgeClient.registerPTY(id, ptyInternal);

      const newEntry = { terminal: null, pty: ptyInternal, name: name };
      this.terminalMap.set(id, newEntry);
      entry = newEntry;
      this.saveState();
      this.onTerminalsChangedEmitter.fire();

      this.bridgeClient.send({
        type: "create",
        id,
        shell,
        args,
        cwd,
        env: {
          FORCE_COLOR: "1",
          TERM: "xterm-256color",
        },
      });

      ptyInternal.onCommandStart(() => {
        if (!ptyInternal.lastBusyStatus) {
          ptyInternal.lastBusyStatus = true;
          this.onTerminalStatusChangedEmitter.fire({
            terminalId: id,
            status: "busy",
          });
        }
        // Always fire to notify UI of the new command text
        this.onTerminalsChangedEmitter.fire();
      });

      // No more monkeypatching handleInput for pendingEcho
      ptyInternal.handleInput = ptyInternal.handleInput.bind(ptyInternal);
    }

    return { id, name: entry!.name };
  }

  attachToVSCode(id: string) {
    const entry = this.terminalMap.get(id);
    if (entry && !entry.pty.attachedToVSCode) {
      entry.terminal = vscode.window.createTerminal({
        name: entry.name,
        pty: entry.pty,
        iconPath: new vscode.ThemeIcon("terminal"),
      });
      entry.pty.attachedToVSCode = true;
      entry.terminal.show(true);

      this.saveState();
      this.onTerminalsChangedEmitter.fire();
    } else if (entry && entry.pty.attachedToVSCode && entry.terminal) {
      entry.terminal.show(true);
    }
  }

  getOutput(id: string): string {
    const entry = this.terminalMap.get(id);
    return entry ? entry.pty.accumulatedOutput : "";
  }

  list() {
    return Array.from(this.terminalMap.entries()).map(([id, entry]) => {
      let cwd = entry.pty.currentCwd;
      let currentCommand = "";
      let isBusy = entry.pty.lastBusyStatus;

      if (isBusy && entry.pty.lastCommandText) {
        currentCommand = entry.pty.lastCommandText;
      }

      const shellType = path.basename(entry.pty.shellPath || "shell");
      const currentName = isBusy
        ? `(zen)${currentCommand}`
        : `(zen)${shellType}`;

      if (entry.name !== currentName) {
        entry.name = currentName;
        entry.pty.updateTitle(currentName);
        if (entry.pty.attachedToVSCode && entry.terminal) {
          vscode.commands.executeCommand(
            "workbench.action.terminal.renameWithArg",
            {
              name: currentName,
            },
          );
        }
      }

      const lines = entry.pty.accumulatedOutput.trim().split("\n");
      const cleanLog = lines
        .slice(-10)
        .join("\n")
        .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "") // Strip ANSI escape codes
        .substring(0, 300);

      // Get prompt prefix info
      const username = os.userInfo().username;
      const hostname = os.hostname();
      let promptPrefix = `${username}@${hostname}:${this.formatPath(cwd || entry.pty.currentCwd)}$`;

      // Try to find conda env from process environ if possible (Linux only for now)
      // Note: We don't have the pid here easily, but we can try to look it up from the bridge info
      // For now, let's use a simplified version or just the system one if available
      const condaEnv = process.env.CONDA_DEFAULT_ENV;
      if (condaEnv) {
        promptPrefix = `(${condaEnv}) ${promptPrefix}`;
      }

      return {
        id,
        name: currentName,
        state: isBusy ? "busy" : "free",
        shellType: shellType,
        cwd: cwd || entry.pty.currentCwd,
        lastLog: cleanLog,
        currentCommand: currentCommand || (isBusy ? "executing..." : ""),
        isAttached: entry.pty.attachedToVSCode,
        promptPrefix: promptPrefix,
      };
    });
  }

  private formatPath(p: string): string {
    const home = os.homedir();
    if (p.startsWith(home)) {
      return "~" + p.substring(home.length);
    }
    return p;
  }

  close(id: string) {
    const entry = this.terminalMap.get(id);
    if (entry) {
      if (entry.terminal) {
        entry.terminal.dispose();
      }
      this.terminalMap.delete(id);
      this.saveState();

      try {
        if (fs.existsSync(entry.pty.logFilePath)) {
          fs.unlinkSync(entry.pty.logFilePath);
        }
      } catch (e) {
        console.error("Failed to delete terminal log file", e);
      }

      this.onTerminalsChangedEmitter.fire();
    }
  }

  focus(id: string) {
    const entry = this.terminalMap.get(id);
    if (entry && entry.terminal) {
      entry.terminal.show();
    }
  }

  stop(id: string) {
    const entry = this.terminalMap.get(id);
    if (entry) {
      entry.pty.stop();
    }
  }

  sendInput(id: string, text: string, actionId?: string) {
    const entry = this.terminalMap.get(id);
    if (entry) {
      let finalInput = text;

      if (actionId) {
        entry.pty.activeActionId = actionId;
        entry.pty.lastCommandText = text.trim();
        entry.pty.lastOutputIndex = entry.pty.accumulatedOutput.length;

        // Wrap the command with markers for detecting start and finish precisely
        const isWindows = os.platform() === "win32";
        const isPwsh =
          entry.pty.shellPath.toLowerCase().includes("pwsh") ||
          entry.pty.shellPath.toLowerCase().includes("powershell");
        const cleanCmd = text.replace(/(?:\r?\n)+$/, ""); // remove trailing newline for wrapping

        if (isWindows && !isPwsh) {
          // cmd.exe
          finalInput = `echo ZEN_CMD_START: ${actionId} & ${cleanCmd} & echo ZEN_CMD_END: ${actionId}\r\n`;
        } else if (isPwsh) {
          // PowerShell
          finalInput = `Write-Output "ZEN_CMD_START: ${actionId}"; ${cleanCmd}; Write-Output "ZEN_CMD_END: ${actionId}"\r\n`;
        } else {
          // bash / zsh
          // Use carefully constructed strings to avoid breaking the shell parser
          finalInput = `echo "ZEN_CMD_START: ${actionId}"; ${cleanCmd}; echo "ZEN_CMD_END: ${actionId}"\n`;
        }

        // Send the input to the PTY
        entry.pty.handleInput(finalInput);

        // Immediately notify UI
        entry.pty.commandStartEmitter.fire();
      } else {
        // Direct manual user typing via terminal view (if typing was enabled)
        entry.pty.handleInput(finalInput);
      }
    }
  }

  stopAll(): void {
    for (const [id, entry] of this.terminalMap) {
      if (entry.terminal) {
        entry.terminal.dispose();
      }
      entry.pty.stop();
    }
    this.terminalMap.clear();
    this.saveState();
  }
}
