import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "pg-connection-string";
import { classifyTarget } from "../db/target.js";
import { devEnv, ENV_FILE_NAMES } from "./dev.mjs";
import { isCanonicalUuid } from "../src/lib/validate/uuid";
import {
  buildProdUrl,
  envFilePgKey,
  envFileSetsDatabaseUrl,
  envFileSetsKey,
  envFileSetsKeyVariant,
  run,
  tokenIsFresh,
  tokenOrg,
} from "./dev-prod.mjs";

const NOW = 1_800_000_000;
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (payload: unknown) => `${b64({ alg: "none" })}.${b64(payload)}.sig`;
const ORG = "0a1b2c3d-0000-4000-8000-00000000000a";
const OTHER = "0a1b2c3d-0000-4000-8000-00000000000b";
const FRESH = jwt({ exp: NOW + 3600, org: ORG });
const STALE = jwt({ exp: NOW + 10, org: ORG });
const NO_ORG = jwt({ exp: NOW + 3600 });
const OTHER_ORG = jwt({ exp: NOW + 3600, org: OTHER });
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
  envFiles?: Record<string, string>;
  password?: string;
  spawnFails?: boolean;
  envThrows?: string;
  envThrowsAt?: number;
  missingTools?: string[];
  busy?: boolean;
  orgAnswer?: string;
  ready?: boolean[];
  clockStep?: number;
  owner?: string;
  exitEarly?: boolean;
  exitCode?: number;
  signalAt?: "spawn" | "ready" | "running";
  signal?: number;
  stopLeft?: number[];
  db?: { ok: boolean; code?: string } | "throws";
};
const dockerCalls: string[][] = [];

async function drive(o: Opts = {}) {
  const trace: string[] = [];
  const out: string[] = [];
  const err: string[] = [];
  const devTokenOrgs: (string | undefined)[] = [];
  const sleeps: number[] = [];
  const helperArgs: unknown[] = [];
  const stops: unknown[] = [];
  type Spawn = { args: string[]; env: Record<string, string | undefined> };
  let spawned = null as Spawn | null;
  const tokens = [...(o.tokens ?? [FRESH])];
  let reads = 0;
  let onSignal: (code: number) => void = () => {};
  let clock = 0;
  let readyCalls = 0;
  const fire = () => onSignal(o.signal ?? 130);
  const code = await run({
    env: o.env ?? {},
    argv: o.argv ?? [],
    now: () => NOW,
    readTokenFile: () => {
      trace.push("token check");
      return tokens.length > 1 ? tokens.shift() : (tokens[0] ?? null);
    },
    runDevToken: async (org?: string) => (
      trace.push("dev-token"),
      devTokenOrgs.push(org),
      helperArgs.push(org),
      o.devTokenCode ?? 0
    ),
    docker: (a: string[]) => {
      trace.push(`docker ${a[0]}`);
      dockerCalls.push(a);
      helperArgs.push(a);
      if (a[0] === "inspect") return o.inspect ?? { status: 0, stdout: "true\n" };
      return { status: o.startStatus ?? 0, stdout: "" };
    },
    probe: async () => (trace.push("probe"), o.probeOk ?? true),
    sleep: async (ms: number) => void sleeps.push(ms),
    readEnvFile: (name: string) => {
      reads += 1;
      if (o.envThrowsAt === reads)
        throw Object.assign(new Error("SECRET-CONTENT"), { code: "EBUSY" });
      if (!trace.includes("env check")) trace.push("env check");
      if (o.envThrows) throw Object.assign(new Error("SECRET-CONTENT"), { code: o.envThrows });
      if (name === ".env.local" && o.envLocal) return o.envLocal;
      return o.envFiles?.[name] ?? null;
    },
    checkTools: () => (trace.push("tools"), o.missingTools ?? []),
    portBusy: async (p: number) => (trace.push("port"), helperArgs.push(p), o.busy ?? false),
    promptOrg: async () => (trace.push("org prompt"), o.orgAnswer ?? ""),
    promptPassword: async () => (trace.push("prompt"), o.password ?? PW),
    checkDb: async () => {
      trace.push("db check");
      if (o.db === "throws") throw new Error(`boom ${PW}`);
      return o.db ?? { ok: true };
    },
    onStopSignal: (cb: (code: number) => void) => (onSignal = cb),
    monoMs: () => (clock += o.clockStep ?? 0),
    probeReady: async (p: number) => {
      trace.push("ready");
      helperArgs.push(p);
      if (o.signalAt === "ready" && readyCalls === 0) fire();
      const seq = o.ready ?? [true];
      return seq[Math.min(readyCalls++, seq.length - 1)];
    },
    spawnApp: async (a: Spawn) => {
      trace.push("spawn");
      spawned = a;
      if (o.spawnFails) throw new Error(`boom ${a.env.DATABASE_URL}`);
      let finish: (c: number) => void = () => {};
      const exit = new Promise<number>((r) => (finish = r));
      if (o.exitEarly) finish(o.exitCode ?? 3);
      if (o.signalAt === "spawn") {
        fire();
        await Promise.resolve();
      }
      return {
        rooted: true,
        exit,
        stop: async (opt: unknown) => {
          trace.push("stop");
          stops.push(opt);
          finish(0);
          return o.stopLeft ?? [];
        },
        owner: async () => {
          trace.push("owner");
          if (o.signalAt === "running") setTimeout(fire, 0);
          else if (o.signalAt === undefined) finish(o.exitCode ?? 0);
          return o.owner ?? "owned";
        },
      };
    },
    out: (m: string) => out.push(m),
    err: (m: string) => err.push(m),
  });
  return { code, trace, out, err, spawned, devTokenOrgs, sleeps, helperArgs, stops };
}

const NOTHING_STARTED = (trace: string[]) =>
  trace.filter(
    (t) =>
      t.startsWith("docker") ||
      ["prompt", "org prompt", "dev-token", "spawn", "token check", "probe"].includes(t),
  );
const NO_APP = ["prompt", "spawn"];

describe("tokenIsFresh", () => {
  it("missing, malformed, bad payload, no exp, near expiry are stale; 121 s is fresh", () => {
    for (const t of [null, "", "abc", "a.b.c", jwt({}), jwt({ exp: NOW + 120 }), STALE]) {
      expect(tokenIsFresh(t, NOW), String(t)).toBe(false);
    }
    expect(tokenIsFresh(jwt({ exp: NOW + 121, org: ORG }), NOW)).toBe(true);
  });

  it("needs an org claim; with an expected org it must match, ignoring case", () => {
    expect(tokenIsFresh(NO_ORG, NOW)).toBe(false);
    expect(tokenIsFresh(jwt({ exp: NOW + 3600, org: 5 }), NOW)).toBe(false);
    expect(tokenIsFresh(FRESH, NOW, OTHER)).toBe(false);
    expect(tokenIsFresh(FRESH, NOW, ORG.toUpperCase())).toBe(true);
    expect(tokenIsFresh(FRESH, NOW, undefined)).toBe(true);
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

describe("envFileSetsKey", () => {
  it("matches every assignment form, for both keys", () => {
    for (const key of ["DATABASE_URL", "SIMAP_DEV_ORG"]) {
      for (const t of [
        `${key}=x`,
        `  ${key} = x`,
        `export ${key}=x`,
        `\uFEFF${key}=x`,
        `${key}: x`,
        `export ${key}: x`,
        `${key}:`,
        `A=1\r\n${key}=x\r\n`,
      ]) {
        expect(envFileSetsKey(t, key), t).toBe(true);
      }
      for (const t of [`# ${key}=x`, `${key}_X=1`, `${key}_X: 1`, "", `OTHER=${key}=1`]) {
        expect(envFileSetsKey(t, key), t).toBe(false);
      }
    }
  });
});

describe("tokenOrg", () => {
  it("agrees with isCanonicalUuid", () => {
    const orgs: unknown[] = [
      ORG,
      ORG.toUpperCase(),
      "00000000-0000-0000-0000-000000000000",
      ` ${ORG}`,
      `${ORG}\n`,
      " ",
      "\u001b[31mx",
      "not-a-uuid",
      "",
      5,
      null,
    ];
    for (const org of orgs) {
      expect(tokenOrg(jwt({ exp: NOW + 3600, org })) !== null, String(org)).toBe(
        isCanonicalUuid(org),
      );
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
  it("refuses with exit 2 before the prompt when an .env file cannot be read", async () => {
    const r = await drive({ envThrows: "EBUSY" });
    expect(r.code).toBe(2);
    expect(r.trace).not.toContain("prompt");
    expect(r.trace).not.toContain("spawn");
    expect(r.err).toEqual([
      "[dev:prod] cannot read .env.local: close whatever holds it and retry (nothing started)",
    ]);
    expect(r.err.join("")).not.toContain("SECRET");
  });
  it("happy path", async () => {
    const r = await drive();
    expect(r.code).toBe(0);
    expect(r.trace).toEqual([
      "env check",
      "tools",
      "port",
      "token check",
      "docker inspect",
      "probe",
      "prompt",
      "db check",
      "spawn",
      "ready",
      "owner",
      "stop",
    ]);
    expect(r.out.slice(-2)).toEqual([
      "[dev:prod] local URL: http://127.0.0.1:3000",
      "PRODUCTION DATA: every change is real.",
    ]);
    expect(r.out.join("\n")).toContain("production data");
  });

  it("full flow without .env files, including sign-in", async () => {
    const r = await drive({ tokens: [null, FRESH], orgAnswer: ORG });
    expect(r.code).toBe(0);
    expect(r.trace).toEqual([
      "env check",
      "tools",
      "port",
      "token check",
      "org prompt",
      "dev-token",
      "token check",
      "docker inspect",
      "probe",
      "prompt",
      "db check",
      "spawn",
      "ready",
      "owner",
      "stop",
    ]);
    expect(r.out.slice(-2)).toEqual([
      "[dev:prod] local URL: http://127.0.0.1:3000",
      "PRODUCTION DATA: every change is real.",
    ]);
  });

  it("db login check: 28P01 or any failure exits 1 with a fixed message, no app, no retry", async () => {
    const failures = [
      { ok: false, code: "28P01" },
      { ok: false, code: "ECONNREFUSED" },
      { ok: false },
      "throws",
    ] as const;
    for (const db of failures) {
      const r = await drive({ db });
      expect(r.code).toBe(1);
      expect(r.trace.filter((t) => t === "db check")).toHaveLength(1);
      expect(r.trace).not.toContain("spawn");
      expect(r.err).toHaveLength(1);
      const all = [...r.out, ...r.err].join("\n");
      expect(all).toContain("nothing started");
      expect(all).not.toContain(PW);
      expect(all).not.toContain("boom");
    }
    const auth = await drive({ db: { ok: false, code: "28P01" } });
    expect(auth.err[0]).toContain("rejected the password");
  });

  it("banner shows the org id, with or without SIMAP_DEV_ORG, never the token", async () => {
    for (const env of [{}, { SIMAP_DEV_ORG: ORG }]) {
      const r = await drive({ env });
      const text = r.out.join("\n");
      expect(text).toContain(`org ${ORG}`);
      expect(text).not.toContain(FRESH);
    }
  });

  it("SIMAP_DEV_ORG: token of another org is refreshed, then runs", async () => {
    const r = await drive({ env: { SIMAP_DEV_ORG: ORG }, tokens: [OTHER_ORG, FRESH] });
    expect(r.code).toBe(0);
    expect(r.trace.filter((t) => t.includes("token"))).toEqual([
      "token check",
      "dev-token",
      "token check",
    ]);
  });

  it("SIMAP_DEV_ORG: case-insensitive match needs no refresh", async () => {
    const r = await drive({ env: { SIMAP_DEV_ORG: ORG.toUpperCase() } });
    expect(r.code).toBe(0);
    expect(r.trace).not.toContain("dev-token");
  });

  it("SIMAP_DEV_ORG: wrong org after refresh exits 1 before docker and prompt", async () => {
    const r = await drive({ env: { SIMAP_DEV_ORG: ORG }, tokens: [OTHER_ORG] });
    expect(r.code).toBe(1);
    expect(r.err.join("\n")).toContain("does not match SIMAP_DEV_ORG");
    expect(r.trace.filter((t) => t.startsWith("docker") || NO_APP.includes(t))).toEqual([]);
  });

  it("token without org is refreshed; still without org exits 1 with the --org hint", async () => {
    const ok = await drive({ tokens: [NO_ORG, FRESH], orgAnswer: ORG });
    expect(ok.code).toBe(0);
    expect(ok.trace.filter((t) => t === "org prompt")).toHaveLength(1);
    const withEnv = await drive({ env: { SIMAP_DEV_ORG: ORG }, tokens: [NO_ORG, FRESH] });
    expect(withEnv.code).toBe(0);
    expect(withEnv.trace).not.toContain("org prompt");
    for (const env of [{ SIMAP_DEV_ORG: ORG }, {}]) {
      const r = await drive({ env, tokens: [NO_ORG], orgAnswer: ORG });
      expect(r.code).toBe(1);
      expect(r.err.join("\n")).toContain("pnpm dev:token --org <uuid>");
      expect(r.trace.filter((t) => t.startsWith("docker") || NO_APP.includes(t))).toEqual([]);
    }
  });

  it("token stale then refreshed", async () => {
    const r = await drive({ tokens: [STALE, FRESH] });
    expect(r.code).toBe(0);
    expect(r.trace.filter((t) => t.includes("token"))).toEqual([
      "token check",
      "dev-token",
      "token check",
    ]);
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

  it("each of the four .env files setting SIMAP_DEV_ORG: exit 2, no prompt, value not printed", async () => {
    for (const name of [".env.local", ".env.development.local", ".env.development", ".env"]) {
      const text = "A=1\nSIMAP_DEV_ORG=leak-me-org\n";
      const r = await drive(
        name === ".env.local" ? { envLocal: text } : { envFiles: { [name]: text } },
      );
      expect(r.code, name).toBe(2);
      expect(
        r.trace.filter((t) => NO_APP.includes(t)),
        name,
      ).toEqual([]);
      expect(r.err.join("\n")).toContain(name);
      expect([...r.out, ...r.err].join("\n")).not.toContain("leak-me-org");
    }
  });

  it("each of the four .env files setting NEXT_PUBLIC_SIMAP_DEV_PROD in any case: exit 2 before the prompt, value not printed", async () => {
    for (const name of [".env.local", ".env.development.local", ".env.development", ".env"]) {
      for (const key of ["NEXT_PUBLIC_SIMAP_DEV_PROD", "next_public_simap_dev_prod"]) {
        const text = ["A=1", `export ${key}=leak-me-flag`, ""].join("\n");
        const r = await drive(
          name === ".env.local" ? { envLocal: text } : { envFiles: { [name]: text } },
        );
        expect(r.code, name).toBe(2);
        expect(
          r.trace.filter((t) => NO_APP.includes(t)),
          name,
        ).toEqual([]);
        expect(r.err.join("\n")).toContain(name);
        expect([...r.out, ...r.err].join("\n")).not.toContain("leak-me-flag");
      }
    }
  });

  it("a commented or look-alike NEXT_PUBLIC_SIMAP_DEV_PROD line does not refuse", async () => {
    const r = await drive({
      envLocal: "# NEXT_PUBLIC_SIMAP_DEV_PROD=1\nNEXT_PUBLIC_SIMAP_DEV_PROD_X=1\n",
    });
    expect(r.code).toBe(0);
  });

  it("commented or look-alike SIMAP_DEV_ORG lines do not refuse", async () => {
    const r = await drive({ envLocal: "# SIMAP_DEV_ORG=x\nSIMAP_DEV_ORG_X=1\n" });
    expect(r.code).toBe(0);
  });

  it("preflight: DATABASE_URL in each of the four files, any letter case: exit 2, names the file, no value", async () => {
    for (const name of FILES) {
      for (const key of ["DATABASE_URL", "database_url"]) {
        const text = `A=1\nexport ${key}=postgres://x:leak-me@h/db\n`;
        const r = await drive(
          name === ".env.local" ? { envLocal: text } : { envFiles: { [name]: text } },
        );
        expect(r.code, name).toBe(2);
        expect(NOTHING_STARTED(r.trace), name).toEqual([]);
        expect(r.trace).not.toContain("tools");
        expect(r.err.join("\n")).toContain(name);
        expect([...r.out, ...r.err].join("\n")).not.toContain("leak-me");
      }
    }
  });

  it("preflight: missing tool exits 1 and names it, nothing started", async () => {
    const r = await drive({ missingTools: ["docker (CLI and running daemon)"] });
    expect(r.code).toBe(1);
    expect(r.err.join("\n")).toContain("docker");
    expect(NOTHING_STARTED(r.trace)).toEqual([]);
    expect(r.trace).not.toContain("port");
  });

  it("preflight: busy port exits 1 and names it, nothing started", async () => {
    const r = await drive({ busy: true, argv: ["--port", "3456"] });
    expect(r.code).toBe(1);
    expect(r.err.join("\n")).toContain("3456");
    expect(NOTHING_STARTED(r.trace)).toEqual([]);
  });

  it("preflight: every refusal precedes token, docker and prompts", async () => {
    for (const o of [
      { envLocal: "SIMAP_DEV_ORG=x" },
      { envFiles: { ".env": "mm_identity_issuer=x" } },
      { envFiles: { ".env": "NEXT_PUBLIC_SIMAP_DEV_PROD=1" } },
      { envThrows: "EBUSY" },
    ]) {
      const r = await drive({ ...o, tokens: [null] });
      expect(r.code).toBe(2);
      expect(NOTHING_STARTED(r.trace)).toEqual([]);
    }
  });

  it("preflight: the port is always explicit (argv, then PORT, then 3000); invalid PORT exits 1", async () => {
    const cases: [Opts, string][] = [
      [{}, "3000"],
      [{ env: { PORT: "4100" } }, "4100"],
      [{ env: { PORT: "4100" }, argv: ["--port=4200"] }, "4200"],
      [{ argv: ["-p", "4300"] }, "4300"],
    ];
    for (const [o, port] of cases) {
      const r = await drive(o);
      expect(r.spawned!.args).toEqual(["dev", "-H", "127.0.0.1", "--port", port]);
      expect(r.helperArgs).toContain(Number(port));
    }
    for (const PORT of ["abc", "0", "70000"]) {
      const r = await drive({ env: { PORT } });
      expect(r.code).toBe(1);
      expect(r.trace).toEqual([]);
    }
  });

  it("non-UUID org claims are no org: no start, not printed, never passed to dev:token", async () => {
    for (const org of [
      " ",
      "\u001b[31mred",
      "not-a-uuid",
      ORG.toUpperCase(),
      "00000000-0000-0000-0000-000000000000",
      ` ${ORG} `,
    ]) {
      const r = await drive({ tokens: [jwt({ exp: NOW + 3600, org })] });
      expect(r.code, org).toBe(1);
      expect(r.trace.filter((t) => t.startsWith("docker") || NO_APP.includes(t))).toEqual([]);
      expect(r.devTokenOrgs).toEqual([]);
      expect([...r.out, ...r.err].join("\n")).not.toContain("red");
    }
  });

  it("empty password exits 1 without spawning", async () => {
    const r = await drive({ password: "" });
    expect(r.code).toBe(1);
    expect(r.trace).not.toContain("spawn");
  });
});

describe("PG* variables in .env files", () => {
  it("finds the key in any letter case, and only a real assignment", () => {
    expect(envFilePgKey("A=1\nexport pgoptions=-c x")).toBe("pgoptions");
    expect(envFilePgKey("PGHOST: h")).toBe("PGHOST");
    expect(envFilePgKey("# PGHOST=h\nOTHER_PGHOST=1\nPG_NOT=\n")).toBe("PG_NOT");
    expect(envFilePgKey("DATABASE_URL=x\nPORT=3")).toBeNull();
  });

  it("is refused in every .env file, naming only the file and key", async () => {
    for (const n of ENV_FILE_NAMES) {
      const r = await drive({ envFiles: { [n]: "pgoptions=SECRET-VALUE" } });
      expect(r.code, n).toBe(2);
      expect(r.err.join("\n")).toContain(`${n} sets pgoptions`);
      expect(r.err.join("\n")).not.toContain("SECRET-VALUE");
      expect(r.trace).not.toContain("dev-token");
      expect(r.trace).not.toContain("spawn");
    }
  });
});

describe("run: child process", () => {
  it("env and argv", async () => {
    const r = await drive({
      env: {
        PGPASSWORD: "x",
        PGHOST: "h",
        PGPORT: "1",
        pgoptions: "-c search_path=x",
        PGAPPNAME: "x",
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
    expect(Object.keys(env).filter((k) => /^PG/i.test(k))).toEqual([]);
    expect(r.spawned!.args).toEqual(["dev", "-H", "127.0.0.1", "--port", "3001"]);
    expect(r.spawned!.args.join(" ")).not.toContain(PW);
  });

  it("child gets the production-data flag, replacing any inherited case variant", async () => {
    const r = await drive({ env: { next_public_simap_dev_prod: "0" } });
    const keys = Object.keys(r.spawned!.env).filter(
      (k) => k.toUpperCase() === "NEXT_PUBLIC_SIMAP_DEV_PROD",
    );
    expect(keys).toEqual(["NEXT_PUBLIC_SIMAP_DEV_PROD"]);
    expect(r.spawned!.env.NEXT_PUBLIC_SIMAP_DEV_PROD).toBe("1");
  });

  it("child NODE_ENV is development, replacing any inherited case variant", async () => {
    const r = await drive({ env: { NODE_ENV: "test", node_env: "production" } });
    const keys = Object.keys(r.spawned!.env).filter((k) => k.toUpperCase() === "NODE_ENV");
    expect(keys).toEqual(["NODE_ENV"]);
    expect(r.spawned!.env.NODE_ENV).toBe("development");
  });

  it("child gets the checked org as the pin", async () => {
    const r = await drive();
    expect(r.spawned!.env.SIMAP_DEV_EXPECTED_ORG).toBe(ORG);
  });

  it("pin is the org checked at startup, after a dev:token refresh too", async () => {
    const r = await drive({ env: { SIMAP_DEV_ORG: ORG }, tokens: [OTHER_ORG, FRESH] });
    expect(r.spawned!.env.SIMAP_DEV_EXPECTED_ORG).toBe(ORG);
  });

  it("pin replaces an inherited value in any letter case", async () => {
    const r = await drive({
      env: { SIMAP_DEV_EXPECTED_ORG: OTHER, simap_dev_expected_org: OTHER },
    });
    const keys = Object.keys(r.spawned!.env).filter(
      (k) => k.toUpperCase() === "SIMAP_DEV_EXPECTED_ORG",
    );
    expect(keys).toEqual(["SIMAP_DEV_EXPECTED_ORG"]);
    expect(r.spawned!.env.SIMAP_DEV_EXPECTED_ORG).toBe(ORG);
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
    for (const file of ["./dev-prod.mjs", "./dev-process.mjs"]) {
      const src = readFileSync(new URL(file, import.meta.url), "utf8");
      for (const api of ["writeFile", "appendFile", "createWriteStream"]) {
        expect(src, file).not.toContain(api);
      }
    }
  });
});

const ISSUER = "https://api.mmlabs.online";
const issuerKeys = (e: Record<string, string | undefined>) =>
  Object.keys(e).filter((k) => k.toUpperCase() === "MM_IDENTITY_ISSUER");
const FILES = ENV_FILE_NAMES as string[];

describe("issuer pin", () => {
  it("child issuer is pinned, replacing inherited case variants", async () => {
    const envs = [
      {
        MM_IDENTITY_ISSUER: "http://localhost:4000",
        mm_identity_issuer: "http://x",
        Mm_Identity_Issuer: "http://y",
      },
      { mm_identity_issuer: "http://x" },
      { mm_identity_issuer: "http://x", NODE_ENV: "production" },
      {},
    ];
    for (const env of envs) {
      const r = await drive({ env });
      expect(issuerKeys(r.spawned!.env)).toEqual(["MM_IDENTITY_ISSUER"]);
      expect(r.spawned!.env.MM_IDENTITY_ISSUER).toBe(ISSUER);
    }
  });

  it("exact-case issuer line in each .env file does not stop dev:prod", async () => {
    for (const name of FILES) {
      const r = await drive({ envFiles: { [name]: "MM_IDENTITY_ISSUER=http://evil.test\n" } });
      expect(r.code, name).toBe(0);
      expect(r.trace).toContain("spawn");
      expect(r.spawned!.env.MM_IDENTITY_ISSUER).toBe(ISSUER);
    }
  });

  const VARIANTS = [
    "mm_identity_issuer=SECRET-ISSUER\n",
    "Mm_Identity_Issuer: SECRET-ISSUER\n",
    "export MM_identity_ISSUER =SECRET-ISSUER\n",
    "A=1\r\nmm_identity_issuer=SECRET-ISSUER\r\n",
    "﻿mm_identity_issuer=SECRET-ISSUER\n",
    "mm_identity_issuer\n=SECRET-ISSUER\n",
  ];
  const cases = FILES.flatMap((n) => VARIANTS.map((v) => [n, v] as const));
  it.each(cases)("a case-variant issuer line in %s exits 2 before the prompt: %j", async (n, v) => {
    const r = await drive({ envFiles: { [n]: v } });
    expect(r.code).toBe(2);
    for (const t of NO_APP) expect(r.trace).not.toContain(t);
    const all = [...r.out, ...r.err].join("\n");
    expect(all).toContain(n);
    expect(all).not.toContain("SECRET-ISSUER");
  });

  it("issuer refusal is not hit by exact case or by other keys", async () => {
    for (const text of [
      "MM_IDENTITY_ISSUER=x\n",
      "# mm_identity_issuer=x\n",
      "MM_IDENTITY_ISSUER_X=x\n",
      "XMM_IDENTITY_ISSUER=x\n",
    ]) {
      const r = await drive({ envFiles: { ".env": text } });
      expect(r.code, text).toBe(0);
    }
    const both = await drive({
      envFiles: { ".env": "MM_IDENTITY_ISSUER=x\nmm_identity_issuer=y\n" },
    });
    expect(both.code).toBe(2);
  });

  it("issuer refusal comes after the read-failure handling", async () => {
    const r = await drive({ envThrows: "EBUSY" });
    expect(r.code).toBe(2);
    expect([...r.out, ...r.err].join("\n")).not.toContain("SECRET-CONTENT");
  });

  it.each([9, 10, 11, 12])(
    "a read error on read %i (issuer loop) exits 2 before the prompt",
    async (n) => {
      const r = await drive({ envThrowsAt: n });
      expect(r.code).toBe(2);
      expect(r.trace).not.toContain("prompt");
      expect(r.trace).not.toContain("spawn");
      const text = [...r.out, ...r.err].join("\n");
      expect(text).toContain(FILES[n - 9]);
      expect(text).not.toContain("SECRET-CONTENT");
    },
  );

  it("envFileSetsKeyVariant", () => {
    const k = "MM_IDENTITY_ISSUER";
    expect(envFileSetsKeyVariant("mm_identity_issuer=1", k)).toBe(true);
    expect(envFileSetsKeyVariant("MM_IDENTITY_ISSUER=1\nMm_Identity_Issuer=2", k)).toBe(true);
    expect(envFileSetsKeyVariant("MM_IDENTITY_ISSUER=1", k)).toBe(false);
    expect(envFileSetsKeyVariant("", k)).toBe(false);
  });

  it("plain dev keeps issuer variants", () => {
    const e = devEnv({ MM_IDENTITY_ISSUER: "x", mm_identity_issuer: "y" });
    expect(e.MM_IDENTITY_ISSUER).toBe("x");
    expect(e.mm_identity_issuer).toBe("y");
  });

  it("@next/env keeps the pinned issuer over every .env file, also after a forced reload", () => {
    const nextRequire = createRequire(createRequire(import.meta.url).resolve("next/package.json"));
    const { loadEnvConfig } = nextRequire("@next/env") as {
      loadEnvConfig: (
        d: string,
        dev: boolean,
        log: object,
        force?: boolean,
      ) => { loadedEnvFiles: { path: string }[] };
    };
    const dir = mkdtempSync(join(tmpdir(), "simap-next-env-"));
    const saved = { ...process.env };
    try {
      for (const n of FILES) writeFileSync(join(dir, n), "MM_IDENTITY_ISSUER=http://localhost:1\n");
      Object.assign(process.env, { NODE_ENV: "development", MM_IDENTITY_ISSUER: ISSUER });
      const quiet = { info() {}, error() {} };
      const want = [...FILES].sort();
      for (const force of [false, true]) {
        const { loadedEnvFiles } = loadEnvConfig(dir, true, quiet, force);
        expect(loadedEnvFiles.map((f) => f.path).sort()).toEqual(want);
        expect(process.env.MM_IDENTITY_ISSUER).toBe(ISSUER);
      }
    } finally {
      for (const k of Object.keys(process.env)) delete process.env[k];
      Object.assign(process.env, saved);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("org flow", () => {
  it("fresh token reused: no prompt, no sign-in", async () => {
    const r = await drive();
    expect(r.trace).not.toContain("org prompt");
    expect(r.trace).not.toContain("dev-token");
  });

  it("stale token with a valid org passes that org to dev:token, no prompt", async () => {
    const r = await drive({ tokens: [STALE, FRESH] });
    expect(r.code).toBe(0);
    expect(r.devTokenOrgs).toEqual([ORG]);
    expect(r.trace).not.toContain("org prompt");
  });

  it("no usable org prompts exactly once and passes the lowercased UUID", async () => {
    const r = await drive({ tokens: [null, FRESH], orgAnswer: `  ${ORG.toUpperCase()}\n` });
    expect(r.code).toBe(0);
    expect(r.trace.filter((t) => t === "org prompt")).toHaveLength(1);
    expect(r.devTokenOrgs).toEqual([ORG]);
    expect(r.out.join("\n")).toContain(`org ${ORG}`);
  });

  it("invalid or empty answer exits 1: no re-prompt, no sign-in, answer not printed", async () => {
    for (const orgAnswer of ["", "   ", "not-a-uuid-leak-me", ORG.slice(1)]) {
      const r = await drive({ tokens: [null], orgAnswer });
      expect(r.code).toBe(1);
      expect(r.trace.filter((t) => t === "org prompt")).toHaveLength(1);
      expect(r.trace).not.toContain("dev-token");
      expect(NOTHING_STARTED(r.trace).filter((t) => t.startsWith("docker"))).toEqual([]);
      expect([...r.out, ...r.err].join("\n")).not.toContain("leak-me");
    }
  });

  it("SIMAP_DEV_ORG set: no prompt, dev:token gets no org argument", async () => {
    const r = await drive({ env: { SIMAP_DEV_ORG: ORG }, tokens: [null, FRESH] });
    expect(r.code).toBe(0);
    expect(r.trace).not.toContain("org prompt");
    expect(r.devTokenOrgs).toEqual([undefined]);
  });

  it("a token for a different org than requested exits 1", async () => {
    const r = await drive({ tokens: [null, OTHER_ORG], orgAnswer: ORG });
    expect(r.code).toBe(1);
    expect(r.err.join("\n")).toContain("requested org");
    expect(r.trace).not.toContain("docker inspect");
    expect(r.trace).not.toContain("prompt");
  });

  it("failed sign-in after the org prompt starts nothing", async () => {
    const r = await drive({ tokens: [null], orgAnswer: ORG, devTokenCode: 1 });
    expect(r.code).toBe(1);
    expect(r.trace.filter((t) => t.startsWith("docker") || NO_APP.includes(t))).toEqual([]);
  });
});

describe("after start", () => {
  const noUrl = (r: { out: string[] }) => expect(r.out.join("\n")).not.toContain("PRODUCTION DATA");

  it("readiness timeout stops the child, exit 1, no URL", async () => {
    const r = await drive({ ready: [false], clockStep: 5000 });
    expect(r.code).toBe(1);
    expect(r.trace.at(-1)).toBe("stop");
    expect(r.trace).not.toContain("owner");
    expect(r.err.join("\n")).toContain("30 s");
    noUrl(r);
  });

  it("503 keeps polling at 2 s, then a 200 proceeds", async () => {
    const r = await drive({ ready: [false, false, true], clockStep: 100 });
    expect(r.code).toBe(0);
    expect(r.trace.filter((t) => t === "ready")).toHaveLength(3);
    expect(r.sleeps.filter((ms) => ms === 2000)).toHaveLength(2);
  });

  it("early child exit stops the tree, exit 1, no URL", async () => {
    const r = await drive({ exitEarly: true, ready: [false] });
    expect(r.code).toBe(1);
    expect(r.trace).toContain("stop");
    noUrl(r);
  });

  it("owner foreign or unknown stops the child, exit 1, no URL", async () => {
    for (const owner of ["foreign", "unknown"]) {
      const r = await drive({ owner });
      expect(r.code, owner).toBe(1);
      expect(r.trace.at(-1)).toBe("stop");
      noUrl(r);
    }
  });
});

describe("stop signal", () => {
  it("during readiness and while running: stop once, exit 130/143/129, no docker stop", async () => {
    for (const signalAt of ["ready", "running"] as const) {
      for (const signal of [130, 143, 129]) {
        const r = await drive({ signalAt, signal, ready: [false, true] });
        expect(r.code, `${signalAt} ${signal}`).toBe(signal);
        expect(r.trace.filter((t) => t === "stop")).toHaveLength(1);
        expect(r.stops).toEqual([{ grace: true, port: expect.any(Number) }]);
        expect(r.trace).not.toContain("docker stop");
      }
    }
  });

  it("arrives before the spawn resolves: the child is still stopped", async () => {
    const r = await drive({ signalAt: "spawn" });
    expect(r.code).toBe(130);
    expect(r.trace.filter((t) => t === "stop")).toHaveLength(1);
    expect(r.trace).not.toContain("ready");
  });

  it("an unconfirmed stop exits non-zero and says so", async () => {
    const r = await drive({ signalAt: "running", stopLeft: [4242] });
    expect(r.code).toBe(130);
    const e = await drive({ owner: "foreign", stopLeft: [4242] });
    expect(e.code).toBe(1);
    expect(e.err.join("\n")).toContain("could not confirm every child stopped (PIDs: 4242)");
    expect(e.err.join("\n")).toContain(
      "may still be running on port 3000: stop it before continuing",
    );
    const ok = await drive({ exitCode: 0, stopLeft: [7] });
    expect(ok.code).toBe(1);
  });
});

describe("secrecy across every helper call", () => {
  it("no password, URL or token in out, err or any helper argument", async () => {
    for (const o of [
      {},
      { ready: [false], clockStep: 5000 },
      { owner: "foreign" },
      { spawnFails: true },
    ]) {
      const r = await drive(o);
      const seen = JSON.stringify([r.out, r.err, r.helperArgs, r.devTokenOrgs, r.spawned?.args]);
      for (const s of [PW, encodeURIComponent(PW), buildProdUrl(PW, 15432), FRESH]) {
        expect(seen).not.toContain(s);
      }
    }
  });
});
