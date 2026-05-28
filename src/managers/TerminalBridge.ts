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

// --- Async log writer with write-queue per terminal ---
const logQueues = new Map<string, { buf: string; writing: boolean; size: number }>();
const MAX_LOG_SIZE = 5 * 1024 * 1024;

function appendToLog(id: string, data: string) {
  const terminal = terminals.get(id);
  if (!terminal || !terminal.logPath) return;

  let q = logQueues.get(id);
  if (!q) {
    q = { buf: "", writing: false, size: 0 };
    logQueues.set(id, q);
  }
  q.buf += data;
  q.size += Buffer.byteLength(data);

  if (!q.writing) flushLog(id);
}

function flushLog(id: string) {
  const terminal = terminals.get(id);
  const q = logQueues.get(id);
  if (!q || !q.buf || !terminal?.logPath) return;

  const chunk = q.buf;
  q.buf = "";
  q.writing = true;

  fs.appendFile(terminal.logPath, chunk, (err) => {
    if (!err && q!.size > MAX_LOG_SIZE) {
      // Rotate: read → trim → rewrite (async, rare)
      q!.size = 0;
      fs.readFile(terminal.logPath, "utf8", (_, content) => {
        if (!content) return;
        const half = Math.floor(MAX_LOG_SIZE / 2);
        fs.writeFile(terminal.logPath, content.substring(content.length - half), () => {});
      });
    }
    q!.writing = false;
    if (q!.buf) flushLog(id); // drain remaining
  });
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
        startStatusInterval();

        ptyProcess.onData((data) => {
          appendToLog(id, data);
          broadcast(id, { type: "output", id, data });
        });

        ptyProcess.onExit(({ exitCode }) => {
          broadcast(id, { type: "exit", id, exitCode });
          terminals.delete(id);
          logQueues.delete(id);
          stopStatusIntervalIfEmpty();
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
        logQueues.delete(id);
        stopStatusIntervalIfEmpty();
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

// --- Status interval: only runs when terminals exist, only broadcasts on change ---
const lastStatus = new Map<string, { isBusy: boolean; cwd: string }>();
let statusInterval: NodeJS.Timeout | null = null;

function startStatusInterval() {
  if (!statusInterval) {
    statusInterval = setInterval(() => {
      for (const [id, term] of terminals.entries()) {
        const isBusy = checkBusy(term.pty.pid);
        const cwd = getCwd(term.pty.pid) || term.cwd;
        const prev = lastStatus.get(id);
        if (!prev || prev.isBusy !== isBusy || prev.cwd !== cwd) {
          lastStatus.set(id, { isBusy, cwd });
          broadcast(id, { type: "status", id, isBusy, cwd });
        }
      }
    }, 2000);
  }
}

function stopStatusIntervalIfEmpty() {
  if (statusInterval && terminals.size === 0) {
    clearInterval(statusInterval);
    statusInterval = null;
    lastStatus.clear();
  }
}

server.listen(SOCKET_PATH, () => {});

// Auto-shutdown: if no clients connect within 30s of start, or all clients disconnect
// and no terminals remain, exit cleanly.
let clientCount = 0;
const idleShutdownTimer = setTimeout(() => {
  if (clientCount === 0) process.exit(0);
}, 30_000);

const _origCreateServer = server;
server.on("connection", () => {
  clientCount++;
  clearTimeout(idleShutdownTimer);
});

// Track disconnects — reuse the existing socket.on("close") in handleMessage scope
// by hooking into the server-level connection event
server.on("connection", (sock: net.Socket) => {
  sock.on("close", () => {
    clientCount--;
    if (clientCount <= 0 && terminals.size === 0) {
      // All clients gone and no terminals — safe to exit
      setTimeout(() => process.exit(0), 5000);
    }
  });
});

process.stdin.resume();
