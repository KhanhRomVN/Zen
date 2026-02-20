import * as vscode from "vscode";
import * as pty from "node-pty";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

class ZenPTY implements vscode.Pseudoterminal {
  public writeEmitter = new vscode.EventEmitter<string>();
  onDidWrite: vscode.Event<string> = this.writeEmitter.event;
  public closeEmitter = new vscode.EventEmitter<number>();
  onDidClose: vscode.Event<number> = this.closeEmitter.event;

  public ptyProcess: pty.IPty | null = null;
  public accumulatedOutput = "";
  public isExecuting = false;
  public currentCwd: string;
  public isPersistent: boolean = false;
  public startTime: number = Date.now();
  public shellPath: string = "";

  constructor(cwd: string) {
    this.currentCwd = cwd;
  }

  open(): void {}
  close(): void {
    this.terminate();
  }

  handleInput(data: string): void {
    if (this.ptyProcess) {
      this.ptyProcess.write(data);
    }
  }

  updateTitle(title: string) {
    // Xterm sequence to update terminal title
    this.writeEmitter.fire(`\x1b]0;${title}\x07`);
  }

  async execute(
    command: string,
  ): Promise<{ output: string; error: string | null }> {
    if (this.isExecuting) {
      return { output: "", error: "Terminal is already executing a command" };
    }

    this.isExecuting = true;
    this.accumulatedOutput = "";

    // Indicate command start in terminal
    this.writeEmitter.fire(`\r\n> ${command}\r\n`);

    return new Promise((resolve) => {
      const shell = os.platform() === "win32" ? "powershell.exe" : "bash";

      this.ptyProcess = pty.spawn(shell, ["-c", command], {
        name: "xterm-color",
        cols: 80,
        rows: 24,
        cwd: this.currentCwd,
        env: { ...process.env, FORCE_COLOR: "1" } as any,
      });

      this.ptyProcess.onData((data) => {
        this.accumulatedOutput += data;
        this.writeEmitter.fire(data);
      });

      this.ptyProcess.onExit(({ exitCode }) => {
        this.isExecuting = false;
        resolve({
          output: this.accumulatedOutput,
          error: exitCode !== 0 ? `Process exited with code ${exitCode}` : null,
        });
        this.ptyProcess = null;
      });
    });
  }

  interrupt() {
    if (this.ptyProcess) {
      // node-pty handles signals correctly.
      // For interactive shell, we usually send Ctrl+C sequence if we want to keep shell alive,
      // or kill with SIGINT if it's a specific command execution.
      if (this.isPersistent) {
        this.ptyProcess.write("\x03");
      } else {
        this.ptyProcess.kill("SIGINT");
      }
    }
  }

  terminate() {
    if (this.ptyProcess) {
      this.ptyProcess.kill();
      this.ptyProcess = null;
    }
  }
}

export class ProcessManager {
  private terminalMap = new Map<
    string,
    {
      terminal: vscode.Terminal;
      pty: ZenPTY;
      name: string;
    }
  >();

  private nextId = 1;
  private onTerminalsChangedEmitter = new vscode.EventEmitter<void>();
  public onTerminalsChanged = this.onTerminalsChangedEmitter.event;

  constructor() {
    vscode.window.onDidCloseTerminal((terminal) => {
      let found = false;
      for (const [id, entry] of this.terminalMap.entries()) {
        if (entry.terminal === terminal) {
          this.terminalMap.delete(id);
          found = true;
          break;
        }
      }
      if (found) {
        this.onTerminalsChangedEmitter.fire();
      }
    });

    // Auto-refresh terminal states and titles every 2 seconds
    setInterval(() => {
      if (this.terminalMap.size > 0) {
        this.list(); // This triggers title updates
        this.onTerminalsChangedEmitter.fire(); // Notify webview
      }
    }, 2000);
  }

  async start(
    actionId: string,
    command: string,
    cwd: string,
    terminalId?: string,
  ): Promise<{ output: string; error: string | null }> {
    let entry = terminalId ? this.terminalMap.get(terminalId) : null;

    if (!entry) {
      const id = terminalId || `zen-${this.nextId++}`;
      const shellName = path.basename(command.split(" ")[0]);
      const name = `(zen)${shellName}`;
      const ptyInternal = new ZenPTY(cwd);
      const terminal = vscode.window.createTerminal({
        name,
        pty: ptyInternal,
        iconPath: new vscode.ThemeIcon("terminal"),
      });

      entry = { terminal, pty: ptyInternal, name: name };
      ptyInternal.shellPath = command;
      this.terminalMap.set(id, entry);
      this.onTerminalsChangedEmitter.fire();
      terminal.show(true);
    }

    return entry.pty.execute(command);
  }

  async startInteractive(
    cwd: string,
    terminalId?: string,
  ): Promise<{ id: string; name: string }> {
    const id = terminalId || `zen-${this.nextId++}`;
    let entry = this.terminalMap.get(id);

    if (!entry) {
      const shell =
        os.platform() === "win32"
          ? "powershell.exe"
          : process.env.SHELL || "/bin/bash";
      const args = os.platform() === "win32" ? [] : ["-li"];
      const shellName = path.basename(shell);
      const name = `(zen)${shellName}`;

      const ptyInternal = new ZenPTY(cwd);
      ptyInternal.isPersistent = true;
      const terminal = vscode.window.createTerminal({
        name,
        pty: ptyInternal,
        iconPath: new vscode.ThemeIcon("terminal"),
      });

      // Update terminal name if possible (though createTerminal name is immutable)
      // We will use the name in our map for display
      ptyInternal.shellPath = shell;
      entry = { terminal, pty: ptyInternal, name: name };
      this.terminalMap.set(id, entry);
      this.onTerminalsChangedEmitter.fire();

      ptyInternal.ptyProcess = pty.spawn(shell, args, {
        name: "xterm-256color",
        cols: 80,
        rows: 24,
        cwd,
        env: {
          ...process.env,
          FORCE_COLOR: "1",
          TERM: "xterm-256color",
        } as any,
      });

      ptyInternal.ptyProcess.onData((data) => {
        ptyInternal.accumulatedOutput += data;
        ptyInternal.writeEmitter.fire(data);
      });

      ptyInternal.ptyProcess.onExit(({ exitCode }) => {
        ptyInternal.closeEmitter.fire(exitCode);
      });

      terminal.show(true);
    }

    return { id, name: entry.name };
  }

  getOutput(id: string): string {
    const entry = this.terminalMap.get(id);
    return entry ? entry.pty.accumulatedOutput : "";
  }

  list() {
    return Array.from(this.terminalMap.entries()).map(([id, entry]) => {
      let cwd = "";
      let currentCommand = "";
      let isBusy = false;
      const shellPid = entry.pty.ptyProcess?.pid;

      if (shellPid) {
        if (os.platform() === "linux") {
          try {
            cwd = fs.readlinkSync(`/proc/${shellPid}/cwd`);
            // Check for children (busy status)
            const children = fs.readdirSync(`/proc/${shellPid}/task`);
            // Spawning 'ps' for child info
            const ppidOutput = require("child_process")
              .execSync(`ps -o comm= --ppid ${shellPid}`, { encoding: "utf8" })
              .trim();
            if (ppidOutput) {
              isBusy = true;
              currentCommand = ppidOutput.split("\n")[0];
            }
          } catch (e) {}
        }
      }

      const lines = entry.pty.accumulatedOutput.trim().split("\n");
      const lastLine = lines.length > 0 ? lines[lines.length - 1] : "";

      const shellType = path.basename(entry.pty.shellPath || "shell");
      const currentName = isBusy
        ? `(zen)${currentCommand}`
        : `(zen)${shellType}`;

      if (entry.name !== currentName) {
        entry.name = currentName;
        entry.pty.updateTitle(currentName);
      }

      return {
        id,
        name: currentName,
        state: isBusy ? "busy" : "idle",
        shellType: shellType,
        cwd: cwd || entry.pty.currentCwd,
        uptime: Math.floor((Date.now() - entry.pty.startTime) / 1000),
        lastLog: lastLine.substring(0, 100),
        currentCommand: currentCommand || (isBusy ? "executing..." : ""),
      };
    });
  }

  close(id: string) {
    const entry = this.terminalMap.get(id);
    if (entry) {
      entry.terminal.dispose();
      this.terminalMap.delete(id);
      this.onTerminalsChangedEmitter.fire();
    }
  }

  focus(id: string) {
    const entry = this.terminalMap.get(id);
    if (entry) {
      entry.terminal.show();
    }
  }

  interrupt(id: string) {
    const entry = this.terminalMap.get(id);
    if (entry) {
      entry.pty.interrupt();
    }
  }

  sendInput(id: string, text: string) {
    const entry = this.terminalMap.get(id);
    if (entry) {
      entry.pty.handleInput(text);
    }
  }

  stopAll(): void {
    for (const [id, entry] of this.terminalMap) {
      entry.terminal.dispose();
    }
    this.terminalMap.clear();
  }

  stop(actionId: string, kill: boolean) {}
}
