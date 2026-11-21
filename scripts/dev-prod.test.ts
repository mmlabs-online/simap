import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "pg-connection-string";
import { classifyTarget } from "../db/target.js";
import { buildProdUrl, envFileSetsDatabaseUrl, run, tokenIsFresh } from "./dev-prod.mjs";

const NOW = 1_800_000_000;
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (payload: unknown) => `${b64({ alg: "none" })}.${b64(payload)}.sig`;
const FRESH = jwt({ exp: NOW + 3600 });
const STALE = jwt({ exp: NOW + 10 });
const PW = "p@ss w/rd%é";

type Opts = {
  env?: Record<string, string | undefined>;
  argv?: string[];
  tokens?: (string | null)[];
  devTokenCode?: number;
  inspect?: { status: number; stdout: string };
  startStatus?: number;
  probeOk?: boolean;
  envLocal?: string | null;
  password?: string;
  spawnFails?: boolean;
};
const dockerCalls: string[][] = [];

async function drive(o: Opts = {}) {
  const trace: string[] = [];
  const out: string[] = [];
  const err: string[] = [];
  type Spawn = { args: string[]; env: Record<string, string | undefined> };
  let spawned = null as Spawn | null;
  const tokens = [...(o.tokens ?? [FRESH])];
  const code = await run({
    env: o.env ?? {},
    argv: o.argv ?? [],
    now: () => NOW,
    readTokenFile: () => {
      trace.push("token check");
      return tokens.length > 1 ? tokens.shift() : (tokens[0] ?? null);
    },
    runDevToken: async () => (trace.push("dev-token"), o.devTokenCode ?? 0),
    docker: (a: string[]) => {
      trace.push(`docker ${a[0]}`);
      dockerCalls.push(a);
      if (a[0] === "inspect") return o.inspect ?? { status: 0, stdout: "true\n" };
      return { status: o.startStatus ?? 0, stdout: "" };
    },
    probe: async () => (trace.push("probe"), o.probeOk ?? true),
    sleep: async () => {},
    readEnvLocal: () => (trace.push("env check"), o.envLocal ?? null),
    promptPassword: async () => (trace.push("prompt"), o.password ?? PW),
    spawnApp: async (a: Spawn) => {
      trace.push("spawn");
      spawned = a;
      if (o.spawnFails) throw new Error(`boom ${a.env.DATABASE_URL}`);
      return 0;
    },
    out: (m: string) => out.push(m),
    err: (m: string) => err.push(m),
  });
  return { code, trace, out, err, spawned };
}

const NO_APP = ["prompt", "spawn"];

describe("tokenIsFresh", () => {
  it("missing, malformed, bad payload, no exp, near expiry are stale; 121 s is fresh", () => {
    for (const t of [null, "", "abc", "a.b.c", jwt({}), jwt({ exp: NOW + 120 }), STALE]) {
      expect(tokenIsFresh(t, NOW), String(t)).toBe(false);
    }
    expect(tokenIsFresh(jwt({ exp: NOW + 121 }), NOW)).toBe(true);
  });
});

describe("envFileSetsDatabaseUrl", () => {
  it("matches assignments and ignores comments and look-alikes", () => {
    for (const t of [
      "DATABASE_URL=x",
      "  DATABASE_URL = x",
      "export DATABASE_URL=x",
      "﻿DATABASE_URL=x",
      "DATABASE_URL: x",
      "export DATABASE_URL: x",
      "DATABASE_URL:",
      "A=1\r\nDATABASE_URL=x\r\n",
    ]) {
      expect(envFileSetsDatabaseUrl(t), t).toBe(true);
    }
    for (const t of [
      "# DATABASE_URL=x",
      "DATABASE_URL_X=1",
      "DATABASE_URL_X: 1",
      "",
      "OTHER=DATABASE_URL=1",
    ]) {
      expect(envFileSetsDatabaseUrl(t), t).toBe(false);
    }
  });
});

describe("buildProdUrl", () => {
  it("round-trips the password through the pg parser", () => {
    const passwords = ["@ : / ? # % & + '\"\\[] x", "Mật khẩu đặc biệt ắằẳ", "50%", "%", "%zz", PW];
    for (const pw of passwords) {
      const url = buildProdUrl(pw, 15432);
      const cfg = parse(url);
      expect(cfg.password, pw).toBe(pw);
      expect(cfg.user).toBe("simap");
      expect(cfg.database).toBe("simap");
      expect(cfg.host).toBe("127.0.0.1");
      expect(cfg.ssl).toBeFalsy();
      expect(classifyTarget({ databaseUrl: url, env: {} }).production).toBe(true);
    }
  });
});

describe("run: step order", () => {
  it("happy path", async () => {
    const r = await drive();
    expect(r.code).toBe(0);
    expect(r.trace).toEqual([
      "token check",
      "docker inspect",
      "probe",
      "env check",
      "prompt",
      "spawn",
    ]);
    expect(r.out.join("\n")).toContain("production data");
  });

  it("token stale then refreshed", async () => {
    const r = await drive({ tokens: [STALE, FRESH] });
    expect(r.code).toBe(0);
    expect(r.trace.slice(0, 3)).toEqual(["token check", "dev-token", "token check"]);
  });

  it("token still stale or dev-token fails: nothing else runs", async () => {
    for (const o of [{ tokens: [STALE] }, { tokens: [STALE], devTokenCode: 1 }]) {
      const r = await drive(o);
      expect(r.code).toBe(1);
      expect(r.trace.filter((t) => t.startsWith("docker") || NO_APP.includes(t))).toEqual([]);
    }
  });

  it("docker stopped starts it only then; failures stop before prompt", async () => {
    const stopped = await drive({ inspect: { status: 0, stdout: "false\n" } });
    expect(stopped.trace).toContain("docker start");
    const running = await drive();
    expect(running.trace).not.toContain("docker start");
    for (const o of [
      { inspect: { status: 0, stdout: "false\n" }, startStatus: 1 },
      { inspect: { status: 1, stdout: "" } },
      { probeOk: false },
    ]) {
      const r = await drive(o);
      expect(r.code).toBe(1);
      expect(r.trace.filter((t) => NO_APP.includes(t))).toEqual([]);
    }
  });

  it("tunnel container: default name, SIMAP_PG_TUNNEL overrides", async () => {
    const inspectArgs = (name: string) => ["inspect", "-f", "{{.State.Running}}", name];
    dockerCalls.length = 0;
    await drive();
    expect(dockerCalls[0]).toEqual(inspectArgs("pg-tunnel-pg-tunnel-1"));
    dockerCalls.length = 0;
    await drive({ env: { SIMAP_PG_TUNNEL: "other-tunnel" } });
    expect(dockerCalls[0]).toEqual(inspectArgs("other-tunnel"));
  });

  it("invalid settings exit before any docker call", async () => {
    for (const o of [
      { env: { SIMAP_PG_TUNNEL: "a b; rm" } },
      { env: { SIMAP_PROD_TUNNEL_PORT: "abc" } },
      { env: { NODE_OPTIONS: "--inspect=9229" } },
      { env: { NODE_OPTIONS: "--report-uncaught-exception" } },
      { env: { NODE_OPTIONS: "--experimental-report" } },
      { argv: ["--turbo"] },
    ]) {
      const r = await drive(o);
      expect(r.code).toBe(1);
      expect(r.trace).toEqual([]);
    }
  });

  it(".env.local that sets DATABASE_URL: exit 2, value not printed", async () => {
    const r = await drive({ envLocal: "DATABASE_URL=postgres://x:leak-me@h/db\n" });
    expect(r.code).toBe(2);
    expect(r.trace.filter((t) => NO_APP.includes(t))).toEqual([]);
    expect([...r.out, ...r.err].join("\n")).not.toContain("leak-me");
  });

  it("empty password exits 1 without spawning", async () => {
    const r = await drive({ password: "" });
    expect(r.code).toBe(1);
    expect(r.trace).not.toContain("spawn");
  });
});

describe("run: child process", () => {
  it("env and argv", async () => {
    const r = await drive({
      env: {
        PGPASSWORD: "x",
        PGHOST: "h",
        PGPORT: "1",
        SIMAP_PROD_TUNNEL_PORT: "16000",
        KEEP: "1",
      },
      argv: ["--port", "3001"],
    });
    const env = r.spawned!.env;
    expect(env.DATABASE_URL).toBe(buildProdUrl(PW, 16000));
    expect(env.SIMAP_DB_TARGET).toBe("production");
    expect(env.NEXT_PUBLIC_SIMAP_DEV_TOKEN).toBe("1");
    expect(env.KEEP).toBe("1");
    for (const v of ["PGPASSWORD", "PGHOST", "PGPORT"]) expect(env[v]).toBeUndefined();
    expect(r.spawned!.args).toEqual(["dev", "-H", "127.0.0.1", "--port", "3001"]);
    expect(r.spawned!.args.join(" ")).not.toContain(PW);
  });

  it("passes the resolved token file to the child", async () => {
    const fromEnv = await drive({ env: { SIMAP_DEV_TOKEN_FILE: "/x/tok" } });
    expect(fromEnv.spawned!.env.SIMAP_DEV_TOKEN_FILE).toBe("/x/tok");
    const dflt = await drive();
    expect(dflt.spawned!.env.SIMAP_DEV_TOKEN_FILE).toMatch(/simap[\\/]dev-token$/);
  });

  it("secrecy on success and on spawn failure", async () => {
    for (const spawnFails of [false, true]) {
      const r = await drive({ spawnFails });
      const all = [...r.out, ...r.err].join("\n");
      expect(r.code).toBe(spawnFails ? 1 : 0);
      for (const s of [PW, encodeURIComponent(PW), buildProdUrl(PW, 15432), "boom"]) {
        expect(all).not.toContain(s);
      }
      expect(all).toContain("production data");
    }
  });

  it("source has no file-write API", () => {
    const src = readFileSync(new URL("./dev-prod.mjs", import.meta.url), "utf8");
    for (const api of ["writeFile", "appendFile", "createWriteStream"]) {
      expect(src).not.toContain(api);
    }
  });
});
