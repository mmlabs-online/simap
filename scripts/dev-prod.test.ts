import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "pg-connection-string";
import { classifyTarget } from "../db/target.js";
import { isCanonicalUuid } from "../src/lib/validate/uuid";
import {
  buildProdUrl,
  envFileSetsDatabaseUrl,
  envFileSetsKey,
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
    readEnvFile: (name: string) => {
      if (!trace.includes("env check")) trace.push("env check");
      if (name === ".env.local" && o.envLocal) return o.envLocal;
      return o.envFiles?.[name] ?? null;
    },
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
    expect(r.trace.slice(0, 3)).toEqual(["token check", "dev-token", "token check"]);
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
    const ok = await drive({ tokens: [NO_ORG, FRESH] });
    expect(ok.code).toBe(0);
    expect(ok.trace).toContain("dev-token");
    for (const env of [{}, { SIMAP_DEV_ORG: ORG }]) {
      const r = await drive({ env, tokens: [NO_ORG] });
      expect(r.code).toBe(1);
      expect(r.err.join("\n")).toContain("pnpm dev:token --org <uuid>");
      expect(r.trace.filter((t) => t.startsWith("docker") || NO_APP.includes(t))).toEqual([]);
    }
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

  it("DATABASE_URL is still checked in .env.local only", async () => {
    const r = await drive({ envFiles: { ".env": "DATABASE_URL=postgres://x:y@h/db" } });
    expect(r.code).toBe(0);
  });

  it("non-UUID org claims are no org: no start, not printed", async () => {
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
      expect([...r.out, ...r.err].join("\n")).not.toContain("red");
    }
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

  it("child gets the production-data flag, replacing any inherited case variant", async () => {
    const r = await drive({ env: { next_public_simap_dev_prod: "0" } });
    const keys = Object.keys(r.spawned!.env).filter(
      (k) => k.toUpperCase() === "NEXT_PUBLIC_SIMAP_DEV_PROD",
    );
    expect(keys).toEqual(["NEXT_PUBLIC_SIMAP_DEV_PROD"]);
    expect(r.spawned!.env.NEXT_PUBLIC_SIMAP_DEV_PROD).toBe("1");
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
    const src = readFileSync(new URL("./dev-prod.mjs", import.meta.url), "utf8");
    for (const api of ["writeFile", "appendFile", "createWriteStream"]) {
      expect(src).not.toContain(api);
    }
  });
});
