import * as vscode from "vscode";
import * as pty from "node-pty";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";

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
  public activeActionId: string | null = null;
  public lastOutputIndex: number = 0;
  public lastBusyStatus: boolean = false;
  public lastCommandText: string | null = null;

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

  stop() {
    if (this.ptyProcess) {
      // Use SIGKILL to stop process completely
      this.ptyProcess.kill("SIGKILL");
      this.ptyProcess = null;
      this.isExecuting = false;
    }
  }

  terminate() {
    if (this.ptyProcess) {
      this.ptyProcess.kill();
      this.ptyProcess = null;
      this.isExecuting = false;
    }
  }

  resetOutput() {
    this.accumulatedOutput = "";
    this.lastOutputIndex = 0;
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

    // Auto-refresh terminal states and titles every 1 second (faster detection)
    setInterval(() => {
      this.updateTerminalStates();
    }, 1000);
  }

  private updateTerminalStates() {
    let changed = false;
    for (const [id, entry] of this.terminalMap.entries()) {
      let isBusy = false;
      const shellPid = entry.pty.ptyProcess?.pid;

      if (shellPid) {
        if (os.platform() === "linux") {
          try {
            // Check for children (busy status)
            // On Linux, PPID is checked via /proc or ps
            const ppidOutput = require("child_process")
              .execSync(`ps -o args= --ppid ${shellPid}`, { encoding: "utf8" })
              .trim();
            if (ppidOutput) {
              isBusy = true;
            }
          } catch (e) {}
        }
      }

      // Transition: Busy -> Not Busy
      if (entry.pty.lastBusyStatus && !isBusy && entry.pty.activeActionId) {
        const output = entry.pty.accumulatedOutput.substring(
          entry.pty.lastOutputIndex,
        );
        this.onCommandFinishedEmitter.fire({
          actionId: entry.pty.activeActionId,
          output: output,
          terminalId: id,
          commandText: entry.pty.lastCommandText || undefined,
        });
        entry.pty.activeActionId = null;
        entry.pty.lastCommandText = null;
        entry.pty.lastOutputIndex = entry.pty.accumulatedOutput.length;
      }

      if (entry.pty.lastBusyStatus !== isBusy) {
        entry.pty.lastBusyStatus = isBusy;
        this.onTerminalStatusChangedEmitter.fire({
          terminalId: id,
          status: isBusy ? "busy" : "free",
        });
        changed = true;
      }
    }

    if (changed || this.terminalMap.size > 0) {
      this.onTerminalsChangedEmitter.fire();
    }
  }

  async startInteractive(
    cwd: string,
    terminalId?: string,
  ): Promise<{ id: string; name: string }> {
    const id = terminalId || crypto.randomUUID();
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
      ptyInternal.shellPath = shell;
      const terminal = vscode.window.createTerminal({
        name,
        pty: ptyInternal,
        iconPath: new vscode.ThemeIcon("terminal"),
      });

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
        this.onDidWriteDataEmitter.fire({
          terminalId: id,
          data: data,
        });
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
      let isBusy = entry.pty.lastBusyStatus;
      const shellPid = entry.pty.ptyProcess?.pid;

      if (shellPid) {
        if (os.platform() === "linux") {
          try {
            cwd = fs.readlinkSync(`/proc/${shellPid}/cwd`);
            if (isBusy) {
              const ppidOutput = require("child_process")
                .execSync(`ps -o args= --ppid ${shellPid}`, {
                  encoding: "utf8",
                })
                .trim();
              if (ppidOutput) {
                currentCommand = ppidOutput.split("\n")[0];
              }
            }
          } catch (e) {}
        }
      }

      const shellType = path.basename(entry.pty.shellPath || "shell");
      const currentName = isBusy
        ? `(zen)${currentCommand}`
        : `(zen)${shellType}`;

      if (entry.name !== currentName) {
        entry.name = currentName;
        entry.pty.updateTitle(currentName);
        entry.terminal.show(true);
        vscode.commands.executeCommand(
          "workbench.action.terminal.renameWithArg",
          {
            name: currentName,
          },
        );
      }

      const lines = entry.pty.accumulatedOutput.trim().split("\n");
      const cleanLog = lines
        .slice(-3)
        .join("\n")
        .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "") // Strip ANSI escape codes
        .substring(0, 300);

      return {
        id,
        name: currentName,
        state: isBusy ? "busy" : "free",
        shellType: shellType,
        cwd: cwd || entry.pty.currentCwd,
        lastLog: cleanLog,
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

  stop(id: string) {
    const entry = this.terminalMap.get(id);
    if (entry) {
      entry.pty.stop();
    }
  }

  sendInput(id: string, text: string, actionId?: string) {
    const entry = this.terminalMap.get(id);
    if (entry) {
      if (actionId) {
        entry.pty.activeActionId = actionId;
        entry.pty.lastCommandText = text.trim();
        entry.pty.lastOutputIndex = entry.pty.accumulatedOutput.length;
      }
      entry.pty.handleInput(text);
    }
  }

  stopAll(): void {
    for (const [id, entry] of this.terminalMap) {
      entry.terminal.dispose();
    }
    this.terminalMap.clear();
  }
}
