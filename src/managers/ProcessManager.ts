import * as vscode from "vscode";
import * as crypto from "crypto";
import * as os from "os";
import { spawn, ChildProcess, SpawnOptions } from "child_process";

// Long-running command patterns — these terminals persist until user stops them
const LONG_RUNNING_PATTERNS = /\b(dev|start|serve|watch|preview|run dev|run start|run serve|run watch|run preview)\b/i;

/** Resolve the shell and spawn args for the current OS.
 *
 *  - Windows: use `cmd.exe /d /s /c` so all standard Windows commands work,
 *    or PowerShell if `COMSPEC` is not set.
 *  - macOS / Linux: use the user's login shell (`$SHELL`) falling back to `/bin/sh`.
 *
 *  Returns `{ shell, args, spawnOptions }` ready to pass to `spawn()`.
 */
function resolveShell(cwd: string): { shell: string; shellArgs: string[]; spawnOpts: SpawnOptions } {
  const platform = os.platform();

  if (platform === "win32") {
    // Prefer PowerShell Core (pwsh) > Windows PowerShell (powershell) > cmd
    const comspec = process.env.COMSPEC || "cmd.exe";
    // cmd.exe: /d disables AutoRun, /s /c allows compound commands
    return {
      shell: comspec,
      shellArgs: ["/d", "/s", "/c"],
      spawnOpts: {
        cwd,
        env: { ...process.env, NO_COLOR: "1" },
        stdio: ["pipe", "pipe", "pipe"],
        // On Windows, shell: true breaks output capture; we wrap manually above
      },
    };
  }

  // macOS / Linux
  const userShell = process.env.SHELL || "/bin/sh";
  return {
    shell: userShell,
    shellArgs: ["-c"],
    spawnOpts: {
      cwd,
      env: { ...process.env, TERM: "dumb", NO_COLOR: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    },
  };
}

interface TerminalEntry {
  writeEmitter: vscode.EventEmitter<string>;
  process: ChildProcess | null;
  cwd: string;
  name: string;
  isBusy: boolean;
  output: string;
  activeActionId: string | null;
  isLongRunning: boolean;
}

const MAX_OUTPUT = 1 * 1024 * 1024; // 1 MB cap

export class ProcessManager {
  private terminalMap = new Map<string, TerminalEntry>();

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

  public setProjectDir(_dir: string) {}
  public setExtensionContext(_ctx: vscode.ExtensionContext) {}

  async startInteractive(cwd: string, terminalId?: string): Promise<{ id: string; name: string }> {
    const id = terminalId || crypto.randomUUID();
    if (this.terminalMap.has(id)) {
      return { id, name: this.terminalMap.get(id)!.name };
    }

    const name = "Zen Terminal";
    const writeEmitter = new vscode.EventEmitter<string>();
    const entry: TerminalEntry = {
      writeEmitter, process: null,
      cwd, name, isBusy: false, output: "",
      activeActionId: null, isLongRunning: false,
    };
    this.terminalMap.set(id, entry);
    this.onTerminalsChangedEmitter.fire();
    return { id, name };
  }

  sendInput(id: string, commandText: string, actionId?: string) {
    const entry = this.terminalMap.get(id);
    if (!entry) return;

    // If a process is running and no actionId, pipe input into its stdin
    if (!actionId && entry.process && entry.isBusy) {
      const input = commandText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      entry.writeEmitter.fire(input.replace(/\n/g, "\r\n")); // echo to UI
      entry.output += input; // include user input in output sent to AI
      entry.process.stdin?.write(input);
      return;
    }

    if (entry.process) {
      try {
        if (os.platform() === "win32") {
          entry.process.kill();
        } else {
          entry.process.kill("SIGTERM");
        }
      } catch (_) {}
      entry.process = null;
    }

    const { shell, shellArgs, spawnOpts } = resolveShell(entry.cwd);
    const cleanCmd = commandText.replace(/\r?\n+$/, "");
    const isLongRunning = LONG_RUNNING_PATTERNS.test(cleanCmd);

    entry.isBusy = true;
    entry.activeActionId = actionId || null;
    entry.isLongRunning = isLongRunning;
    entry.output = "";

    this.onTerminalStatusChangedEmitter.fire({ terminalId: id, status: "busy" });
    this.onTerminalsChangedEmitter.fire();

    entry.writeEmitter.fire(`$ ${cleanCmd}\r\n`);

    const child = spawn(shell, [...shellArgs, cleanCmd], spawnOpts);
    entry.process = child;

    const onData = (chunk: Buffer) => {
      const clean = chunk.toString("utf8")
        .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "")
        .replace(/\x1b\][^\x07]*\x07/g, "");
      entry.writeEmitter.fire(clean.replace(/\r?\n/g, "\r\n"));
      entry.output += clean;
      if (entry.output.length > MAX_OUTPUT) {
        entry.output = entry.output.substring(entry.output.length - MAX_OUTPUT / 2);
      }
      this.onDidWriteDataEmitter.fire({ terminalId: id, data: clean });
    };

    child.stdout!.on("data", onData);
    child.stderr!.on("data", onData);

    // Track when each stream has fully flushed before firing onCommandFinished
    let stdoutEnded = false;
    let stderrEnded = false;
    let processClosed = false;
    let exitCode: number | null = null;

    const tryFinish = () => {
      if (!processClosed || !stdoutEnded || !stderrEnded) return;

      entry.process = null;
      entry.isBusy = false;
      entry.writeEmitter.fire("\r\n");

      if (actionId) {
        entry.activeActionId = null;
        console.log(`[ProcessManager] process close → firing onCommandFinished`, { actionId, terminalId: id, outputLength: entry.output.length, exitCode });
        this.onCommandFinishedEmitter.fire({ actionId, output: entry.output, terminalId: id, commandText: cleanCmd });
      }

      this.onTerminalStatusChangedEmitter.fire({ terminalId: id, status: "free" });
      this.onTerminalsChangedEmitter.fire();

      // Auto-cleanup after command finishes to free resources
      this._cleanup(id);
    };

    child.stdout!.on("end", () => { stdoutEnded = true; tryFinish(); });
    child.stderr!.on("end", () => { stderrEnded = true; tryFinish(); });

    child.on("close", (code) => {
      processClosed = true;
      exitCode = code;
      tryFinish();
    });

    child.on("error", (err) => {
      entry.writeEmitter.fire(`Error: ${err.message}\r\n`);
      entry.process = null;
      entry.isBusy = false;
      if (actionId) {
        entry.activeActionId = null;
        console.error(`[ProcessManager] process error → firing onCommandFinished`, { actionId, terminalId: id, error: err.message });
        this.onCommandFinishedEmitter.fire({ actionId, output: err.message, terminalId: id, commandText: cleanCmd });
      }
      this.onTerminalStatusChangedEmitter.fire({ terminalId: id, status: "free" });
      this.onTerminalsChangedEmitter.fire();
      this._cleanup(id);
    });
  }

  private _cleanup(id: string) {
    const entry = this.terminalMap.get(id);
    if (!entry) return;
    entry.writeEmitter.dispose();
    this.terminalMap.delete(id);
    this.onTerminalsChangedEmitter.fire();
  }

  attachToVSCode(_id: string) {}
  focus(_id: string) {}

  getOutput(id: string): string {
    return this.terminalMap.get(id)?.output ?? "";
  }

  list() {
    return Array.from(this.terminalMap.entries()).map(([id, e]) => ({
      id,
      name: e.name,
      state: e.isBusy ? "busy" : "free",
      shellType: "shell",
      cwd: e.cwd,
      lastLog: e.output.slice(-500),
      currentCommand: "",
      isAttached: false,
      promptPrefix: "",
      activeActionId: e.activeActionId,
      isLongRunning: e.isLongRunning,
    }));
  }

  stop(id: string) {
    const entry = this.terminalMap.get(id);
    if (!entry) return;
    if (entry.process) {
      try {
        if (os.platform() === "win32") {
          // SIGTERM is not supported on Windows; use SIGKILL or taskkill
          entry.process.kill();
        } else {
          entry.process.kill("SIGTERM");
        }
      } catch (_) {}
      entry.process = null;
    }
    const actionId = entry.activeActionId;
    entry.activeActionId = null;
    entry.isBusy = false;
    if (actionId) {
      this.onCommandFinishedEmitter.fire({ actionId, output: entry.output, terminalId: id });
    }
    this.onTerminalStatusChangedEmitter.fire({ terminalId: id, status: "free" });
    this.onTerminalsChangedEmitter.fire();
    this._cleanup(id);
  }

  close(id: string) {
    const entry = this.terminalMap.get(id);
    if (!entry) return;
    if (entry.process) {
      try {
        if (os.platform() === "win32") {
          entry.process.kill();
        } else {
          entry.process.kill("SIGTERM");
        }
      } catch (_) {}
    }
    entry.writeEmitter.dispose();
    this.terminalMap.delete(id);
    this.onTerminalsChangedEmitter.fire();
  }

  stopAll() {
    for (const id of [...this.terminalMap.keys()]) {
      this.close(id);
    }
  }
}
