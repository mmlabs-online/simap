// Process helpers for `pnpm dev:prod` / scripts/start-dev.sh (SIM-032): tool and port checks, readiness probe, and
// starting and stopping the app's whole process tree. Helper commands get literals and validated integers only.
// Never touches docker, so the tunnel keeps running. No secret passes through here except the app's child env.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import http from "node:http";
import net from "node:net";
import { join } from "node:path";

const WIN = process.platform === "win32";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const INT = /^[0-9]+$/;

// ---- pure parsers and rules ----

/**
 * Parses the Windows snapshot ("P pid ppid filetime", "L pid", then "END"); null when malformed or cut short, or, when
 * `selfPid` is given, when the table does not contain that process (a failed read still prints END).
 */
export function parseWindowsSnapshot(text, selfPid) {
  const procs = [];
  const listeners = [];
  let end = false;
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const f = t.split(" ");
    if (end) return null;
    if (t === "END") end = true;
    else if (f[0] === "P" && f.length === 4 && f.slice(1).every((x) => INT.test(x))) {
      procs.push({ pid: Number(f[1]), ppid: Number(f[2]), start: BigInt(f[3]) });
    } else if (f[0] === "L" && f.length === 2 && INT.test(f[1])) listeners.push(Number(f[1]));
    else return null;
  }
  if (!end || (selfPid !== undefined && !procs.some((p) => p.pid === selfPid))) return null;
  return { procs, listeners };
}

/** lsof -Fp output: one "p<pid>" line per listener. Empty is an empty list; anything else malformed is null. */
export function parsePosixListeners(text) {
  const pids = [];
  for (const t of String(text ?? "").split(/\r?\n/)) {
    if (!t.trim()) continue;
    if (!/^p[0-9]+$/.test(t.trim())) return null;
    pids.push(Number(t.trim().slice(1)));
  }
  return pids;
}

/** `ps -A -o pid=,pgid=` output; null when malformed or empty. */
export function parsePosixPs(text) {
  const rows = [];
  for (const t of String(text ?? "").split(/\r?\n/)) {
    if (!t.trim()) continue;
    const m = /^\s*([0-9]+)\s+([0-9]+)\s*$/.exec(t);
    if (!m) return null;
    rows.push({ pid: Number(m[1]), pgid: Number(m[2]) });
  }
  return rows.length ? rows : null;
}

/**
 * Descendants of `root` ({pid, start}) in a process table of {pid, ppid, start}. A process counts as a child of a member
 * when its ppid is the member's PID, it started no earlier than the member, and, if that PID now belongs to a different
 * process (PID reuse), it started before that process. Orphans of a dead root are kept, but if `root.end` (FILETIME of
 * its exit) is set, a direct child that started after it is a child of a reused PID and is dropped. Cycles end.
 */
export function descendantsOf(table, root) {
  const found = [];
  const seen = new Set([`${root.pid}:${root.start}`]);
  const queue = [root];
  while (queue.length) {
    const m = queue.shift();
    const holder = table.find((p) => p.pid === m.pid);
    for (const p of table) {
      const key = `${p.pid}:${p.start}`;
      if (seen.has(key) || p.ppid !== m.pid || p.start < m.start) continue;
      if (m.end !== undefined && p.start > m.end) continue;
      if (holder && holder.start !== m.start && p.start >= holder.start) continue;
      seen.add(key);
      found.push(p);
      queue.push(p);
    }
  }
  return found;
}

/** "owned" when there is a listener and every one is in the tree; "foreign" if any is not; else "unknown". */
export function classifyOwner(listeners, treePids) {
  if (!Array.isArray(listeners) || listeners.length === 0) return "unknown";
  const tree = new Set(treePids);
  return listeners.every((p) => tree.has(p)) ? "owned" : "foreign";
}

// ---- tools, port, readiness ----

/** Names of missing tools; empty when all are present. Read-only. */
export function checkTools(root) {
  const missing = [];
  const docker = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], {
    encoding: "utf8",
    timeout: 15000,
  });
  if (docker.error || docker.status !== 0) missing.push("docker (CLI and running daemon)");
  try {
    createRequire(join(root, "package.json")).resolve("next/dist/bin/next");
  } catch {
    missing.push("next (run pnpm install)");
  }
  if (WIN) {
    if (!existsSync(psPath())) missing.push("powershell");
  } else {
    for (const tool of ["lsof", "ps"]) {
      const found = spawnSync("sh", ["-c", `command -v ${tool}`], { encoding: "utf8" });
      if (found.status !== 0) missing.push(tool);
    }
  }
  return missing;
}

function connects(host, port) {
  return new Promise((done) => {
    const s = net.connect({ host, port, timeout: 2000 });
    s.once("connect", () => (s.destroy(), done(true)));
    s.once("timeout", () => (s.destroy(), done(true)));
    s.once("error", (e) => {
      s.destroy();
      const free =
        e.code === "ECONNREFUSED" ||
        (host === "::1" && /^(EADDRNOTAVAIL|EAFNOSUPPORT)$/.test(e.code));
      done(!free);
    });
  });
}

function bindFails(port) {
  return new Promise((done) => {
    const s = net.createServer();
    s.once("error", () => done(true));
    s.listen({ port, host: "127.0.0.1", exclusive: true }, () => s.close(() => done(false)));
  });
}

/** True when something listens on `port` (connect on 127.0.0.1 or ::1, or the bind fails). Fails closed. */
export async function portBusy(port) {
  if ((await connects("127.0.0.1", port)) || (await connects("::1", port))) return true;
  return bindFails(port);
}

/** One readiness attempt: HTTP 200 and body {"status":"ok"} from 127.0.0.1, no redirect, no auth or cookie header. */
export function probeReady(port, timeoutMs) {
  return new Promise((done) => {
    const agent = new http.Agent({ keepAlive: false });
    // `timeout` below is only a socket idle limit; this timer is the hard total limit (a server can trickle bytes).
    const hard = setTimeout(() => (req.destroy(), finish(false)), timeoutMs);
    const finish = (v) => (clearTimeout(hard), agent.destroy(), done(v));
    const req = http.get(
      { host: "127.0.0.1", port, path: "/api/readyz", agent, timeout: timeoutMs },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => {
          body += c;
          if (body.length > 1024) res.destroy();
        });
        res.on("end", () => finish(res.statusCode === 200 && body.trim() === '{"status":"ok"}'));
        res.on("error", () => finish(false));
        res.on("close", () => finish(false));
      },
    );
    req.on("timeout", () => (req.destroy(), finish(false)));
    req.on("error", () => finish(false));
  });
}

// ---- platform I/O ----

function psPath() {
  return join(
    process.env.SystemRoot || "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
}

function powershell(script) {
  const r = spawnSync(psPath(), ["-NoProfile", "-NonInteractive", "-Command", script], {
    encoding: "utf8",
    timeout: 20000,
    windowsHide: true,
  });
  return r.error || r.status !== 0 ? null : r.stdout;
}

function winSnapshot(port) {
  const n = Number.isInteger(port) ? port : 0;
  const script =
    "$ErrorActionPreference='SilentlyContinue';" +
    "Get-CimInstance Win32_Process|Where-Object{$_.CreationDate}|ForEach-Object{'P {0} {1} {2}' -f $_.ProcessId,$_.ParentProcessId,$_.CreationDate.ToFileTimeUtc()};" +
    (n
      ? `Get-NetTCPConnection -State Listen -LocalPort ${n}|ForEach-Object{'L '+$_.OwningProcess};`
      : "") +
    "'END'";
  return parseWindowsSnapshot(powershell(script), process.pid);
}

// Opens each process (the handle pins it), compares its start time with the recorded one (CIM and the process agree within 10 microseconds), and only then kills it.
function winKill(members) {
  const items = members.map((m) => `'${m.pid}:${m.start}'`).join(",");
  powershell(
    `foreach($e in ${items}){$a=$e.Split(':');try{$q=[Diagnostics.Process]::GetProcessById([int]$a[0]);$h=$q.Handle;` +
      "if([math]::Abs($q.StartTime.ToFileTimeUtc()-[int64]$a[1]) -lt 100){$q.Kill()}}catch{}}",
  );
}

// FILETIME (100 ns ticks since 1601) of now.
const fileTimeNow = () => BigInt(Date.now() + 11644473600000) * 10000n;

// Only ESRCH means the group is gone; EPERM means it exists.
function posixAlive(pid) {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (e) {
    return e.code !== "ESRCH";
  }
}

function posixSignal(pid, sig) {
  try {
    process.kill(-pid, sig);
  } catch {
    // ESRCH: gone already. Anything else: posixAlive decides, so the stop is never reported as confirmed.
  }
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 10000 });
  return r.error || r.status === null || r.status > 1 ? null : r.stdout;
}

/**
 * Starts `cmd args` with stdin closed and output inherited, as the leader of its own process tree.
 * Returns { pid, exit, stop, owner }: `exit` resolves with the exit code; `stop({ grace })` ends the whole tree and
 * resolves with the PIDs it could not confirm stopped (empty = done; 0 = no PID to list, name the port); with `port`,
 * a final check must also find no listener on it. `owner(port)` is "owned", "foreign" or "unknown".
 * `snapshot`, `kill` and `listeners` are injectable for tests.
 */
export async function startApp({
  cmd,
  args,
  env,
  cwd,
  snapshot = winSnapshot,
  kill = winKill,
  listeners = /** @type {(port: number) => number[] | null} */ (() => []),
}) {
  const child = spawn(cmd, args, {
    stdio: ["ignore", "inherit", "inherit"],
    env,
    cwd,
    detached: !WIN,
  });
  await new Promise((ok, fail) => {
    child.once("spawn", ok);
    child.once("error", () => fail(new Error("spawn failed")));
  });
  // A later kill error must never become an uncaught exception.
  child.on("error", () => {});
  let exited = false;
  let rootEnd;
  const exit = new Promise((done) =>
    child.once("exit", (code) => ((exited = true), (rootEnd = fileTimeNow()), done(code ?? 1))),
  );
  const rootOf = (snap) => {
    const row = snap?.procs.find((p) => p.pid === child.pid);
    return row ? { pid: child.pid, start: row.start } : null;
  };
  let root = WIN ? rootOf(snapshot(0)) : null;
  // Every tree member (pid:start) seen in any snapshot, so a member whose parent exited is still stopped.
  const known = new Map();
  const keyOf = (m) => `${m.pid}:${m.start}`;

  const winTree = (snap) => {
    const live = (m) => snap.procs.some((p) => p.pid === m.pid && p.start === m.start);
    const tree = new Map();
    const add = (m) => tree.set(keyOf(m), m);
    if (live(root)) add(root);
    descendantsOf(snap.procs, { ...root, end: rootEnd }).forEach(add);
    // Live remembered members and everything below them; never from a dead member.
    for (const m of [...known.values()]) {
      if (!live(m)) continue;
      add(m);
      descendantsOf(snap.procs, m).forEach(add);
    }
    for (const [k, m] of tree) known.set(k, m);
    return [...tree.values()];
  };
  // Last resort on the handle Node holds (cannot hit a reused PID) when the process table cannot be read.
  const killRoot = async () => {
    if (exited) return;
    try {
      child.kill();
    } catch {}
    await Promise.race([exit, sleep(2000)]);
  };

  // True once the group is gone (ESRCH). After that it is never probed or signalled again.
  const waitGone = async (n) => {
    for (let i = 0; i < n; i++) {
      if (!posixAlive(child.pid)) return true;
      await sleep(100);
    }
    return !posixAlive(child.pid);
  };
  const posixStop = async () => {
    if (!posixAlive(child.pid)) return [];
    posixSignal(child.pid, "SIGTERM");
    if (await waitGone(30)) return [];
    posixSignal(child.pid, "SIGKILL");
    return (await waitGone(20)) ? [] : [child.pid];
  };

  let stopping = null;
  const winStop = async (grace) => {
    // While the child is held, its PID is ours: retry the snapshot before any kill to learn the root's identity.
    for (let i = 0; i < 3 && !root && !exited; i++) {
      if (i) {
        await sleep(300);
        if (exited) break; // the PID may be free now: never adopt it
      }
      root = rootOf(snapshot(0));
    }
    let survivors = known.size ? [...known.values()].map((m) => m.pid) : [child.pid];
    // An exited root is not something to stop by hand; if nothing else is listed, 0 means "name the port".
    const report = () => {
      const pids = survivors.filter((p) => !(p === child.pid && exited));
      return pids.length ? pids : [0];
    };
    const look = () => {
      const snap = root && snapshot(0);
      if (!snap) return null;
      const left = winTree(snap);
      if (left.length) survivors = left.map((m) => m.pid);
      return left;
    };
    if (grace) {
      look();
      await Promise.race([exit, sleep(1500)]);
    }
    if (!root) {
      await killRoot();
      return report();
    }
    // A snapshot that fails is never read as "nothing left": kill the root by handle, then try again.
    for (let sweep = 0; sweep < 4; sweep++) {
      const left = look();
      if (!left) {
        await killRoot();
        await sleep(300);
        continue;
      }
      if (!left.length) return [];
      if (sweep === 3) return report();
      kill([...left].reverse());
      await sleep(300);
    }
    return report();
  };
  // Clean only if a final check finds no listener on the app port (never kills by port).
  const stopTree = async (grace, port) => {
    const left = WIN ? await winStop(grace) : await posixStop();
    if (left.length || !Number.isInteger(port)) return left;
    for (let i = 0; i < 3; i++) {
      // The real bind probe decides (fail closed); a listener query can only add doubt, never clear it.
      if ((await listeners(port))?.length === 0 && !(await portBusy(port))) return [];
      if (i < 2) await sleep(200);
    }
    return [0];
  };

  return {
    pid: child.pid,
    rooted: WIN ? root !== null : true,
    exit,
    stop: (/** @type {{ grace?: boolean, port?: number }} */ { grace = false, port } = {}) =>
      (stopping ??= stopTree(grace, port)),
    async owner(port) {
      if (!Number.isInteger(port)) return "unknown";
      if (WIN) {
        const snap = root ? snapshot(port) : null;
        return snap
          ? classifyOwner(
              snap.listeners,
              winTree(snap).map((m) => m.pid),
            )
          : "unknown";
      }
      const listeners = parsePosixListeners(
        run("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fp"]),
      );
      const ps = parsePosixPs(run("ps", ["-A", "-o", "pid=,pgid="]));
      if (!listeners || !ps || exited) return "unknown";
      return classifyOwner(
        listeners,
        ps.filter((p) => p.pgid === child.pid).map((p) => p.pid),
      );
    },
  };
}
