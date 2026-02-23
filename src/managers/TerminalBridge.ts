import * as net from "net";
import * as pty from "node-pty";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";

const SOCKET_PATH = path.join(os.homedir(), "khanhromvn-zen", "bridge.sock");

if (!fs.existsSync(path.dirname(SOCKET_PATH))) {
  fs.mkdirSync(path.dirname(SOCKET_PATH), { recursive: true });
}

// Remove old socket if it exists (only if we are starting fresh)
if (fs.existsSync(SOCKET_PATH)) {
  try {
    fs.unlinkSync(SOCKET_PATH);
  } catch (e) {}
}

const terminals = new Map<
  string,
  { pty: pty.IPty; sockets: Set<net.Socket>; cwd: string; logPath: string }
>();

function appendToLog(id: string, data: string) {
  const terminal = terminals.get(id);
  if (!terminal || !terminal.logPath) return;

  const logPath = terminal.logPath;
  try {
    fs.appendFileSync(logPath, data);
    // Simple rotation: check size every 1MB
    const stats = fs.statSync(logPath);
    const MAX_SIZE = 5 * 1024 * 1024;
    if (stats.size > MAX_SIZE) {
      const content = fs.readFileSync(logPath, "utf8");
      const halfSize = Math.floor(MAX_SIZE / 2);
      const newContent = content.substring(content.length - halfSize);
      fs.writeFileSync(logPath, newContent, "utf8");
    }
  } catch (e) {
    console.error(`Failed to log for ${id}`, e);
  }
}

function broadcast(id: string, msg: any) {
  const terminal = terminals.get(id);
  if (terminal) {
    const data = JSON.stringify(msg) + "\n";
    for (const socket of terminal.sockets) {
      if (socket.writable) {
        socket.write(data);
      }
    }
  }
}

const server = net.createServer((socket) => {
  socket.on("data", (chunk) => {
    try {
      const lines = chunk
        .toString()
        .split("\n")
        .filter((l) => l.trim());
      for (const line of lines) {
        const msg = JSON.parse(line);
        handleMessage(msg, socket);
      }
    } catch (e) {
      console.error("Failed to parse message", e);
    }
  });

  socket.on("close", () => {
    for (const term of terminals.values()) {
      term.sockets.delete(socket);
    }
  });

  function send(msg: any) {
    if (socket.writable) {
      socket.write(JSON.stringify(msg) + "\n");
    }
  }

  function handleMessage(msg: any, socket: net.Socket) {
    const { type, id } = msg;

    if (type === "create") {
      if (terminals.has(id)) {
        // Re-attach to existing
        const term = terminals.get(id)!;
        term.sockets.add(socket);
        // Update logPath if provided (might change on project reload)
        if (msg.logPath) {
          term.logPath = msg.logPath;
        }
        send({ type: "created", id, status: "exists" });
        // Send immediate status update
        send({
          type: "status",
          id,
          isBusy: checkBusy(term.pty.pid),
          cwd: getCwd(term.pty.pid) || term.cwd,
        });
        return;
      }

      const { shell, args, cwd, env, logPath } = msg;
      try {
        const ptyProcess = pty.spawn(shell, args || [], {
          name: "xterm-256color",
          cols: 80,
          rows: 24,
          cwd: cwd || os.homedir(),
          env: { ...process.env, ...env } as any,
        });

        const term = {
          pty: ptyProcess,
          sockets: new Set([socket]),
          cwd: cwd || os.homedir(),
          logPath: logPath || "",
        };
        terminals.set(id, term);

        ptyProcess.onData((data) => {
          appendToLog(id, data);
          broadcast(id, { type: "output", id, data });
        });

        ptyProcess.onExit(({ exitCode }) => {
          broadcast(id, { type: "exit", id, exitCode });
          terminals.delete(id);
        });

        send({ type: "created", id });
      } catch (e: any) {
        send({ type: "error", id, message: e.message });
      }
    } else if (type === "input") {
      const term = terminals.get(id);
      if (term) {
        term.pty.write(msg.data);
      }
    } else if (type === "resize") {
      const term = terminals.get(id);
      if (term) {
        term.pty.resize(msg.cols, msg.rows);
      }
    } else if (type === "close") {
      const term = terminals.get(id);
      if (term) {
        term.pty.kill();
        terminals.delete(id);
      }
    } else if (type === "list") {
      const list = Array.from(terminals.entries()).map(([id, term]) => {
        return {
          id,
          pid: term.pty.pid,
          cwd: getCwd(term.pty.pid) || term.cwd,
          isBusy: checkBusy(term.pty.pid),
        };
      });
      send({ type: "list", terminals: list });
    }
  }
});

function getCwd(pid: number): string {
  try {
    if (os.platform() === "linux") {
      return fs.readlinkSync(`/proc/${pid}/cwd`);
    }
  } catch (e) {}
  return "";
}

function checkBusy(pid: number): boolean {
  try {
    if (os.platform() === "linux") {
      // Read TPGID (field 8) and PGID (field 5) from /proc/[pid]/stat
      const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
      const parts = stat.split(" ");
      // The process name might contain spaces and is enclosed in parens,
      // so we find the last paren index to correctly start counting.
      const lastParenIdx = stat.lastIndexOf(")");
      const remaining = stat.substring(lastParenIdx + 2).split(" ");

      // status (f3), ppid (f4), pgid (f5), sid (f6), tty_nr (f7), tpgid (f8)
      // Relative to the index after ") ":
      // status is [0], ppid is [1], pgid is [2], sid is [3], tty_nr is [4], tpgid is [5]

      const state = remaining[0];
      const pgid = parseInt(remaining[2]);
      const tpgid = parseInt(remaining[5]);

      const isBusy = tpgid !== -1 && tpgid !== pgid;

      // Special case for shell being in 'R' (Running) or 'D' (Disk sleep) state but TPGID matches PGID
      // This can happen briefly or during some specific shell operations.
      // However, usually shell is in 'S' (Interruptible sleep) when waiting for input.
      if (!isBusy && (state === "R" || state === "D")) {
        // If the shell itself is actively running/calculating, it's busy even if it's the foreground group
        return true;
      }

      return isBusy;
    }
  } catch (e) {}
  return false;
}

// Proactive status broadcasting every 500ms
setInterval(() => {
  for (const [id, term] of terminals.entries()) {
    const isBusy = checkBusy(term.pty.pid);
    const cwd = getCwd(term.pty.pid) || term.cwd;
    broadcast(id, { type: "status", id, isBusy, cwd });
  }
}, 500);

server.listen(SOCKET_PATH, () => {
  console.log(`Bridge listening on ${SOCKET_PATH}`);
});

process.stdin.resume();
