import * as cp from "child_process";

export class ProcessManager {
  private processes = new Map<
    string,
    {
      process: cp.ChildProcess;
      output: string;
      error: string;
      resolve: (result: { output: string; error: string | null }) => void;
    }
  >();

  start(
    actionId: string,
    command: string,
    cwd: string,
  ): Promise<{ output: string; error: string | null }> {
    return new Promise((resolve) => {
      // Use exec to support shell syntax (e.g. pipes, &&) easily, but we want stream access
      // cp.exec returns a ChildProcess, so we can access stdout/stderr streams.
      const child = cp.exec(
        command,
        { cwd, maxBuffer: 1024 * 1024 * 50 }, // 50MB buffer
        (err, stdout, stderr) => {
          // This callback runs on completion
          if (!this.processes.has(actionId)) return; // Already handled (detached/killed)

          // Standard completion
          this.processes.delete(actionId);
          resolve({
            output: stdout || "",
            error: err ? err.message : null,
          });
        },
      );

      // Collect real-time output for partial capture
      let accumulatedOutput = "";
      child.stdout?.on("data", (data) => {
        accumulatedOutput += data;
        if (this.processes.has(actionId)) {
          this.processes.get(actionId)!.output = accumulatedOutput;
        }
      });
      child.stderr?.on("data", (data) => {
        accumulatedOutput += data; // Combine for simplicity or separate? User wanted logs.
        if (this.processes.has(actionId)) {
          this.processes.get(actionId)!.output = accumulatedOutput;
        }
      });

      this.processes.set(actionId, {
        process: child,
        output: "", // Will be updated by listeners
        error: "",
        resolve,
      });
    });
  }

  stop(
    actionId: string,
    kill: boolean,
  ): { output: string; error: string | null } | null {
    const entry = this.processes.get(actionId);
    if (!entry) return null;

    this.processes.delete(actionId);

    if (kill) {
      // kill the process tree? exec spawns a shell.
      // simple kill might not kill children.
      // For now, simple kill.
      try {
        entry.process.kill();
      } catch (e) {
        // ignore
      }
    } else {
      // Detach: We just stop tracking it.
      // If we want it to truly persist in background independently of VSCode, we'd need 'detached: true' and 'ref: false' in spawn.
      // But execution via 'exec' is attached to shell.
      // For "Detach" as "Stop waiting", we essentially just resolve early.
      // The process might die if the extension host closes or if it fills up buffers if we stop listening?
      // We leave the process running (it is still attached to extension host).
      entry.process.stdout?.pause();
      entry.process.stderr?.pause();
      entry.process.unref();
    }

    // Force resolve the promise loop?
    // The promise returned by start() is waiting for resolve().
    // We should call it!
    entry.resolve({
      output: entry.output,
      error: kill ? "Process killed by user" : "Process detached by user",
    });

    return {
      output: entry.output,
      error: null,
    };
  }

  stopAll(): void {
    const actionIds = Array.from(this.processes.keys());
    for (const actionId of actionIds) {
      this.stop(actionId, true);
    }
  }
}
