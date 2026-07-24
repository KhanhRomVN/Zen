/**
 *? Usage:
 *    Quản lý terminal ảo: tạo, chạy lệnh shell, pipe stdin/stdout, throttle data, auto-cleanup. Phát hiện lệnh long-running (dev/start/serve/watch...).
 *
 
 */

import * as vscode from "vscode";
import { ChildProcess, spawn, SpawnOptions } from "child_process";
import * as crypto from "crypto";
import * as os from "os";

const LONG_RUNNING_PATTERNS =
  /\b(dev|start|serve|watch|preview|run dev|run start|run serve|run watch|run preview)\b/i;

function resolveShell(cwd: string): {
  shell: string;
  shellArgs: string[];
  spawnOpts: SpawnOptions;
} {
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

export class TerminalManager {
  private terminalMap = new Map<string, TerminalEntry>();

  private onCommandFinishedEmitter = new vscode.EventEmitter<{
    actionId: string;
    output: string;
    terminalId: string;
    commandText?: string;
    exitCode?: number | null;
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

  // Throttle terminal data events to reduce IPC overhead
  private dataBuffers = new Map<
    string,
    { data: string; timer: NodeJS.Timeout | null }
  >();
  private readonly DATA_FLUSH_INTERVAL = 100; // ms

  async startInteractive(
    cwd: string,
    terminalId?: string,
  ): Promise<{ id: string; name: string }> {
    const id = terminalId || crypto.randomUUID();
    if (this.terminalMap.has(id)) {
      return { id, name: this.terminalMap.get(id)!.name };
    }

    const name = "Zen Terminal";
    const writeEmitter = new vscode.EventEmitter<string>();
    const entry: TerminalEntry = {
      writeEmitter,
      process: null,
      cwd,
      name,
      isBusy: false,
      output: "",
      activeActionId: null,
      isLongRunning: false,
    };
    this.terminalMap.set(id, entry);

    return { id, name };
  }

  private flushDataBuffer(terminalId: string) {
    const buffer = this.dataBuffers.get(terminalId);
    if (!buffer || !buffer.data) return;

    this.onDidWriteDataEmitter.fire({
      terminalId,
      data: buffer.data,
    });

    buffer.data = "";
    buffer.timer = null;
  }

  private bufferTerminalData(terminalId: string, data: string) {
    let buffer = this.dataBuffers.get(terminalId);
    if (!buffer) {
      buffer = { data: "", timer: null };
      this.dataBuffers.set(terminalId, buffer);
    }

    buffer.data += data;

    if (buffer.timer) {
      clearTimeout(buffer.timer);
    }

    buffer.timer = setTimeout(() => {
      this.flushDataBuffer(terminalId);
    }, this.DATA_FLUSH_INTERVAL);
  }

  sendInput(id: string, commandText: string, actionId?: string) {
    const entry = this.terminalMap.get(id);
    if (!entry) {
      return;
    }

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

    this.onTerminalStatusChangedEmitter.fire({
      terminalId: id,
      status: "busy",
    });

    entry.writeEmitter.fire(`$ ${cleanCmd}\r\n`);

    const child = spawn(shell, [...shellArgs, cleanCmd], spawnOpts);
    entry.process = child;

    const onData = (chunk: Buffer) => {
      const clean = chunk
        .toString("utf8")
        .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "")
        .replace(/\x1b\][^\x07]*\x07/g, "");
      entry.writeEmitter.fire(clean.replace(/\r?\n/g, "\r\n"));
      entry.output += clean;
      if (entry.output.length > MAX_OUTPUT) {
        entry.output = entry.output.substring(
          entry.output.length - MAX_OUTPUT / 2,
        );
      }
      // Buffer data instead of firing immediately
      this.bufferTerminalData(id, clean);
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

      // Flush any remaining buffered data before finishing
      this.flushDataBuffer(id);

      entry.process = null;
      entry.isBusy = false;
      entry.writeEmitter.fire("\r\n");

      if (actionId) {
        entry.activeActionId = null;
        this.onCommandFinishedEmitter.fire({
          actionId,
          output: entry.output,
          terminalId: id,
          commandText: cleanCmd,
          exitCode,
        });
      }

      this.onTerminalStatusChangedEmitter.fire({
        terminalId: id,
        status: "free",
      });

      // Auto-cleanup after command finishes to free resources
      this._cleanup(id);
    };

    child.stdout!.on("end", () => {
      stdoutEnded = true;
      tryFinish();
    });
    child.stderr!.on("end", () => {
      stderrEnded = true;
      tryFinish();
    });

    child.on("close", (code) => {
      processClosed = true;
      exitCode = code;
      tryFinish();
    });

    child.on("error", (err) => {
      entry.writeEmitter.fire(`Error: ${err.message}\r\n`);
      this.flushDataBuffer(id);
      entry.process = null;
      entry.isBusy = false;

      if (actionId) {
        entry.activeActionId = null;
        console.error(
          `[TerminalManager] process error → firing onCommandFinished`,
          { actionId, terminalId: id, error: err.message },
        );
        this.onCommandFinishedEmitter.fire({
          actionId,
          output: err.message,
          terminalId: id,
          commandText: cleanCmd,
        });
      }
      this.onTerminalStatusChangedEmitter.fire({
        terminalId: id,
        status: "free",
      });
      this._cleanup(id);
    });
  }

  private _cleanup(id: string) {
    const entry = this.terminalMap.get(id);
    if (!entry) return;

    // Clear any pending data buffer
    const buffer = this.dataBuffers.get(id);
    if (buffer?.timer) {
      clearTimeout(buffer.timer);
    }
    this.dataBuffers.delete(id);

    entry.writeEmitter.dispose();
    this.terminalMap.delete(id);
  }

  close(id: string) {
    const entry = this.terminalMap.get(id);
    if (!entry) return;

    this.flushDataBuffer(id);

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

    // Clear buffer
    const buffer = this.dataBuffers.get(id);
    if (buffer?.timer) {
      clearTimeout(buffer.timer);
    }
    this.dataBuffers.delete(id);

    this.terminalMap.delete(id);
  }

  /**
   * Đóng tất cả terminal. Chỉ được dùng nội bộ bởi extension:
   * - dispose(): khi extension bị vô hiệu hóa
   * - extension.ts activate(): dọn terminal cũ từ session trước
   */
  closeAll() {
    for (const id of [...this.terminalMap.keys()]) {
      this.close(id);
    }
  }

  dispose() {
    for (const buffer of this.dataBuffers.values()) {
      if (buffer.timer) {
        clearTimeout(buffer.timer);
      }
    }
    this.dataBuffers.clear();

    // Stop all terminals
    this.closeAll();

    // Dispose all event emitters
    this.onCommandFinishedEmitter.dispose();
    this.onDidWriteDataEmitter.dispose();
    this.onTerminalStatusChangedEmitter.dispose();
  }
}
