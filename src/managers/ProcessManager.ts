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
  public attachedToVSCode: boolean = false;

  constructor(cwd: string) {
    this.currentCwd = cwd;
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

      // We no longer fire command finish purely on busy status falling off.
      // The exact execution boundary is now managed by ZEN_START/ZEN_END markers in the PTY output.
      if (entry.pty.lastBusyStatus && !isBusy && entry.pty.activeActionId) {
        // We still clear the 'busy' UI state if the process visually dies,
        // but the actual "runCommandResult" is now fired when ZEN_CMD_END arrives.
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
      // Removed the immediate createTerminal call here. We only create the entry.

      entry = { terminal: null as any, pty: ptyInternal, name: name };
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
        if (data.length > 0) {
          ptyInternal.accumulatedOutput += data;
          ptyInternal.writeEmitter.fire(data);
          this.onDidWriteDataEmitter.fire({
            terminalId: id,
            data: data,
          });

          // Look for markers in the accumulated output string from the last index
          if (ptyInternal.activeActionId) {
            const currentOutput = ptyInternal.accumulatedOutput.substring(
              ptyInternal.lastOutputIndex,
            );

            // Note: The terminals may echo \r\n, so we look for ZEN_CMD_END with the action id
            const endMarker = `ZEN_CMD_END: ${ptyInternal.activeActionId}`;
            const endIdx = currentOutput.indexOf(endMarker);

            if (endIdx !== -1) {
              const output = currentOutput; // We send the whole chunk. The Webview will clean the markers.

              this.onCommandFinishedEmitter.fire({
                actionId: ptyInternal.activeActionId,
                output: output,
                terminalId: id,
                commandText: ptyInternal.lastCommandText || undefined,
              });

              ptyInternal.activeActionId = null;
              ptyInternal.lastCommandText = null;
              // Set the index to AFTER the marker so next command doesn't read it again
              ptyInternal.lastOutputIndex =
                ptyInternal.accumulatedOutput.length;
            }
          }
        }
      });

      ptyInternal.ptyProcess.onExit(({ exitCode }) => {
        ptyInternal.closeEmitter.fire(exitCode);
      });

      // No more monkeypatching handleInput for pendingEcho
      ptyInternal.handleInput = ptyInternal.handleInput.bind(ptyInternal);

      // terminal.show(true); // Don't show immediately
    }

    return { id, name: entry.name };
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
      if (entry.terminal) {
        entry.terminal.dispose();
      }
      this.terminalMap.delete(id);
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
  }
}
