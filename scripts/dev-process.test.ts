import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyOwner,
  descendantsOf,
  parsePosixListeners,
  parsePosixPs,
  parseWindowsSnapshot,
  portBusy,
  probeReady,
  startApp,
} from "./dev-process.mjs";

const WIN = process.platform === "win32";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const P = (pid: number, ppid: number, start: number) => ({ pid, ppid, start: BigInt(start) });

describe("parsers", () => {
  it("parseWindowsSnapshot: good, malformed, empty and cut-short output", () => {
    const good = parseWindowsSnapshot("P 10 4 133\r\nP 11 10 134\nL 11\nEND\n");
    expect(good).toEqual({ procs: [P(10, 4, 133), P(11, 10, 134)], listeners: [11] });
    expect(parseWindowsSnapshot("END")).toEqual({ procs: [], listeners: [] });
    // A failed read still prints END: valid only when it contains the launcher's own PID.
    expect(parseWindowsSnapshot("END", 10)).toBeNull();
    expect(parseWindowsSnapshot("P 11 4 133\nEND", 10)).toBeNull();
    expect(parseWindowsSnapshot("P 10 4 133\nEND", 10)).toEqual({
      procs: [P(10, 4, 133)],
      listeners: [],
    });
    for (const bad of ["", null, "P 10 4 133\n", "P 10 x 133\nEND", "Q 1\nEND", "END\nP 1 2 3"]) {
      expect(parseWindowsSnapshot(bad), String(bad)).toBeNull();
    }
  });

  it("parsePosix*: good, malformed and empty output", () => {
    expect(parsePosixListeners("p12\np40\n")).toEqual([12, 40]);
    expect(parsePosixListeners("")).toEqual([]);
    expect(parsePosixListeners("f3\n")).toBeNull();
    expect(parsePosixPs(" 12 12\n 40  12\n")).toEqual([
      { pid: 12, pgid: 12 },
      { pid: 40, pgid: 12 },
    ]);
    for (const bad of ["", "x y", "12\n"]) expect(parsePosixPs(bad), bad).toBeNull();
  });
});

describe("descendantsOf", () => {
  const root = { pid: 10, start: 100n };
  const pids = (t: ReturnType<typeof P>[]) => descendantsOf(t, root).map((p) => p.pid);

  it("follows children and grandchildren", () => {
    expect(pids([P(10, 1, 100), P(11, 10, 110), P(12, 11, 120), P(13, 1, 130)])).toEqual([11, 12]);
  });

  it("excludes a stale ppid after PID reuse", () => {
    // pid 10 is now another process that started at 500; a child that started later cannot be ours.
    expect(pids([P(10, 1, 500), P(11, 10, 510), P(12, 10, 150)])).toEqual([12]);
    expect(pids([P(11, 10, 50)])).toEqual([]);
  });

  it("includes an orphan of a dead root", () => {
    expect(pids([P(11, 10, 110)])).toEqual([11]);
  });

  it("drops a direct child of a dead root that started after the root's exit (PID reuse)", () => {
    // pid 10 died at 200, was reused by Y, Y started Z (510) and exited: Z is not ours; orphan 11 (110) is.
    const dead = { ...root, end: 200n };
    const ids = (t: ReturnType<typeof P>[]) => descendantsOf(t, dead).map((p) => p.pid);
    expect(ids([P(11, 10, 510)])).toEqual([]);
    expect(ids([P(11, 10, 110), P(12, 11, 120), P(13, 10, 510)])).toEqual([11, 12]);
  });

  it("terminates on a cycle", () => {
    expect(pids([P(11, 10, 110), P(12, 11, 120), P(11, 12, 110)]).length).toBeLessThan(4);
  });
});

describe("classifyOwner", () => {
  it("owned, foreign, mixed = foreign, none and failed query = unknown", () => {
    expect(classifyOwner([5], [5, 6])).toBe("owned");
    expect(classifyOwner([9], [5, 6])).toBe("foreign");
    expect(classifyOwner([5, 9], [5, 6])).toBe("foreign");
    expect(classifyOwner([], [5])).toBe("unknown");
    expect(classifyOwner(null, [5])).toBe("unknown");
  });
});

function listen(host = "127.0.0.1"): Promise<net.Server> {
  return new Promise((ok) => {
    const s = net.createServer();
    s.listen(0, host, () => ok(s));
  });
}

describe("portBusy", () => {
  it("a real listener on 127.0.0.1 is busy; a free port is not", async () => {
    const s = await listen();
    const port = (s.address() as net.AddressInfo).port;
    try {
      expect(await portBusy(port)).toBe(true);
    } finally {
      await new Promise((r) => s.close(r));
    }
    expect(await portBusy(port)).toBe(false);
  });
});

describe("probeReady", () => {
  async function serve(handler: http.RequestListener) {
    const s = http.createServer(handler);
    await new Promise<void>((ok) => s.listen(0, "127.0.0.1", ok));
    return { s, port: (s.address() as net.AddressInfo).port };
  }

  it("200 with the ok body is ready; 503, wrong body and redirect are not; no auth or cookie header", async () => {
    const seen: http.IncomingHttpHeaders[] = [];
    let mode = "ok";
    const { s, port } = await serve((req, res) => {
      seen.push(req.headers);
      if (mode === "redirect") res.writeHead(302, { location: "/x" }).end();
      else if (mode === "503") res.writeHead(503).end('{"status":"ok"}');
      else res.writeHead(200).end(mode === "ok" ? '{"status":"ok"}' : '{"status":"no"}');
    });
    try {
      const results: Record<string, boolean> = {};
      for (mode of ["ok", "503", "wrong", "redirect"]) results[mode] = await probeReady(port, 2000);
      expect(results).toEqual({ ok: true, "503": false, wrong: false, redirect: false });
      for (const h of seen) {
        expect(h.authorization).toBeUndefined();
        expect(h.cookie).toBeUndefined();
      }
    } finally {
      s.close();
    }
  });

  it("a server that trickles bytes still ends within the hard limit", async () => {
    const { s, port } = await serve((_req, res) => {
      res.writeHead(200);
      const t = setInterval(() => res.write(" "), 100);
      res.on("close", () => clearInterval(t));
    });
    try {
      const t0 = Date.now();
      expect(await probeReady(port, 1000)).toBe(false);
      expect(Date.now() - t0).toBeLessThan(3000);
    } finally {
      s.closeAllConnections();
      s.close();
    }
  }, 15_000);

  it("a closed port is not ready", async () => {
    const s = await listen();
    const port = (s.address() as net.AddressInfo).port;
    await new Promise((r) => s.close(r));
    expect(await probeReady(port, 1000)).toBe(false);
  });
});

// ---- real processes: only trees this test creates ----

const LISTENER =
  "const s=require('net').createServer().listen(0,'127.0.0.1',()=>{require('fs').writeFileSync(process.argv[1],JSON.stringify({pid:process.pid,port:s.address().port}))});setInterval(()=>{},1000)";
const rootScript = (exitFirst: boolean) =>
  `const g=require('child_process').spawn(process.execPath,['-e',${JSON.stringify(LISTENER)},process.argv[1]],{stdio:'ignore',detached:process.platform==='win32'});` +
  (exitFirst ? "g.unref();setTimeout(()=>process.exit(0),1500)" : "setInterval(()=>{},1000)");
const MIN_ENV = Object.fromEntries(
  ["PATH", "Path", "SystemRoot", "SYSTEMROOT"].flatMap((k) =>
    process.env[k] ? [[k, process.env[k] as string]] : [],
  ),
) as unknown as NodeJS.ProcessEnv;
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
async function readInfo(file: string): Promise<{ pid: number; port: number }> {
  for (let i = 0; i < 100; i++) {
    if (existsSync(file)) {
      try {
        return JSON.parse(readFileSync(file, "utf8"));
      } catch {}
    }
    await sleep(100);
  }
  throw new Error("fixture did not start");
}
const hasLsof = WIN || spawnSync("sh", ["-c", "command -v lsof"]).status === 0;

type App = Awaited<ReturnType<typeof startApp>>;
type Info = { pid: number; port: number };

async function withTree(
  exitFirst: boolean,
  body: (t: { app: App; grand: Info; bystander: Info }) => Promise<void>,
) {
  const dir = mkdtempSync(join(tmpdir(), "simap-tree-"));
  const gFile = join(dir, "g.json");
  const bFile = join(dir, "b.json");
  const by = spawn(process.execPath, ["-e", LISTENER, bFile], { stdio: "ignore", env: MIN_ENV });
  let app: App | null = null;
  let grand: Info | null = null;
  try {
    const bystander = await readInfo(bFile);
    app = await startApp({
      cmd: process.execPath,
      args: ["-e", rootScript(exitFirst), gFile],
      env: MIN_ENV,
      cwd: tmpdir(),
    });
    grand = await readInfo(gFile);
    await body({ app, grand, bystander });
    expect(alive(bystander.pid)).toBe(true);
  } finally {
    if (app) await app.stop();
    if (grand && alive(grand.pid)) process.kill(grand.pid);
    by.kill();
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}

describe("real tree", () => {
  it("stop kills parent and grandchild; an unrelated bystander stays alive", async () => {
    await withTree(false, async ({ app, grand }) => {
      expect(await app.stop({ grace: false })).toEqual([]);
      await sleep(300);
      expect(alive(app.pid!)).toBe(false);
      expect(alive(grand.pid)).toBe(false);
    });
  }, 60_000);

  it("root exits first; the orphan grandchild is still stopped", async () => {
    await withTree(true, async ({ app, grand }) => {
      await app.exit;
      expect(alive(grand.pid)).toBe(true);
      expect(await app.stop()).toEqual([]);
      await sleep(300);
      expect(alive(grand.pid)).toBe(false);
    });
  }, 60_000);

  it.skipIf(!WIN)(
    "snapshot unreadable: the real child is still killed and the stop reports it unconfirmed",
    async () => {
      const app = await startApp({
        cmd: process.execPath,
        args: ["-e", "setInterval(()=>{},1000)"],
        env: MIN_ENV,
        cwd: tmpdir(),
      });
      expect(app.rooted).toBe(true);
      const saved = process.env.SystemRoot;
      process.env.SystemRoot = join(tmpdir(), "simap-no-such-root");
      try {
        const left = await app.stop();
        expect(left).toEqual([app.pid]);
        await sleep(300);
        expect(alive(app.pid!)).toBe(false);
      } finally {
        process.env.SystemRoot = saved;
        if (alive(app.pid!)) process.kill(app.pid!);
      }
    },
    60_000,
  );

  it("a member whose parent exits during the grace wait is still stopped", async () => {
    const dir = mkdtempSync(join(tmpdir(), "simap-tree-"));
    const gFile = join(dir, "g.json");
    const go = join(dir, "go");
    const spawnLeaf = `require('child_process').spawn(process.execPath,['-e',${JSON.stringify(LISTENER)},process.argv[1]],{stdio:'ignore',detached:process.platform==='win32'})`;
    const mid = `${spawnLeaf};setInterval(()=>{if(require('fs').existsSync(process.argv[2]))process.exit(0)},100)`;
    const top = `require('child_process').spawn(process.execPath,['-e',${JSON.stringify(mid)},process.argv[1],process.argv[2]],{stdio:'ignore',detached:process.platform==='win32'});setInterval(()=>{},1000)`;
    const app = await startApp({
      cmd: process.execPath,
      args: ["-e", top, gFile, go],
      env: MIN_ENV,
      cwd: tmpdir(),
    });
    let leaf: Info | null = null;
    try {
      leaf = await readInfo(gFile);
      // The first snapshot is taken before stop() returns its promise; only then does the middle process exit.
      const stopped = app.stop({ grace: true });
      writeFileSync(go, "");
      expect(await stopped).toEqual([]);
      await sleep(300);
      expect(alive(leaf.pid)).toBe(false);
      expect(alive(app.pid!)).toBe(false);
    } finally {
      if (leaf && alive(leaf.pid)) process.kill(leaf.pid);
      await app.stop();
      rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
  }, 60_000);

  it.skipIf(!WIN)(
    "first snapshot unreadable: it is retried before any kill and the grandchild is stopped",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "simap-tree-"));
      const gFile = join(dir, "g.json");
      const saved = process.env.SystemRoot;
      process.env.SystemRoot = join(tmpdir(), "simap-no-such-root");
      let app: App | null = null;
      let grand: Info | null = null;
      try {
        app = await startApp({
          cmd: process.execPath,
          args: ["-e", rootScript(false), gFile],
          env: MIN_ENV,
          cwd: tmpdir(),
        });
        expect(app.rooted).toBe(false);
        grand = await readInfo(gFile);
        process.env.SystemRoot = saved;
        expect(await app.stop()).toEqual([]);
        await sleep(300);
        expect(alive(app.pid!)).toBe(false);
        expect(alive(grand.pid)).toBe(false);
      } finally {
        process.env.SystemRoot = saved;
        if (grand && alive(grand.pid)) process.kill(grand.pid);
        if (app && alive(app.pid!)) process.kill(app.pid!);
        rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
      }
    },
    60_000,
  );

  it.skipIf(!hasLsof)(
    "owner: owned for the grandchild's port, foreign for a bystander's",
    async () => {
      await withTree(false, async ({ app, grand, bystander }) => {
        expect(await app.owner(grand.port)).toBe("owned");
        expect(await app.owner(bystander.port)).toBe("foreign");
        expect(await app.owner(1)).not.toBe("owned");
      });
    },
    60_000,
  );
});
