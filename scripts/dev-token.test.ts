import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertOutsideRepo,
  cookieHeader,
  loginErrorMessage,
  parseArgs,
  parseLoginAnswer,
  parseTokenAnswer,
  run,
  tokenErrorMessage,
  tokenFilePath,
  tokenOrg,
  writeTokenFile,
} from "./dev-token.mjs";

const ACC = "11111111-1111-4111-8111-111111111111";
const ORG = "22222222-2222-4222-8222-222222222222";
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (claims: Record<string, unknown>) => `${b64({ alg: "ES256" })}.${b64(claims)}.sig`;
const PASSWORD = "hunter2-secret";

describe("parseArgs", () => {
  it("reads --org, --org=, SIMAP_DEV_ORG; the flag beats the env", () => {
    expect(parseArgs(["--org", ORG])).toEqual({ org: ORG });
    expect(parseArgs([`--org=${ORG}`])).toEqual({ org: ORG });
    expect(parseArgs([], { SIMAP_DEV_ORG: ORG })).toEqual({ org: ORG });
    const other = "33333333-3333-4333-8333-333333333333";
    expect(parseArgs(["--org", other], { SIMAP_DEV_ORG: ORG })).toEqual({ org: other });
    expect(parseArgs([])).toEqual({ org: null });
  });

  it("rejects a non-canonical uuid and unknown arguments", () => {
    expect(() => parseArgs(["--org", "nope"])).toThrow(/UUID/);
    expect(() => parseArgs(["--org"])).toThrow(/UUID/);
    expect(() => parseArgs(["--bogus"])).toThrow(/usage/);
  });
});

describe("answer parsing", () => {
  it("parseLoginAnswer needs a UUID account_id", () => {
    expect(parseLoginAnswer({ account_id: ACC })).toEqual({ accountId: ACC });
    expect(() => parseLoginAnswer({ account_id: "x" })).toThrow("unexpected sign-in answer");
    expect(() => parseLoginAnswer(null)).toThrow("unexpected sign-in answer");
  });

  it("parseTokenAnswer mirrors identityClient.token", () => {
    const t = jwt({ exp: 1 });
    const good = { access_token: t, token_type: "Bearer", audience: "simap", expires_in: 3600 };
    expect(parseTokenAnswer(good)).toEqual({ token: t, expiresIn: 3600 });
    for (const bad of [
      { ...good, token_type: "bearer" },
      { ...good, audience: "other" },
      { ...good, access_token: "not-a-jwt" },
      { ...good, expires_in: NaN },
      { ...good, expires_in: 0 },
      { ...good, expires_in: 86401 },
      { ...good, expires_in: undefined },
    ]) {
      expect(() => parseTokenAnswer(bad)).toThrow("unexpected token answer");
    }
  });

  it("tokenOrg errors when the org claim differs from --org (case-insensitive)", () => {
    expect(tokenOrg(jwt({ org: ORG.toUpperCase() }), ORG)).toBe(ORG.toUpperCase());
    expect(tokenOrg(jwt({}), null)).toBeNull();
    expect(() => tokenOrg(jwt({ org: ACC }), ORG)).toThrow(/does not match/);
    expect(() => tokenOrg(jwt({}), ORG)).toThrow(/does not match/);
  });

  it("cookieHeader keeps name=value pairs only", () => {
    expect(cookieHeader(["a=1; Path=/; HttpOnly", "b=2; Secure"])).toBe("a=1; b=2");
  });
});

describe("error mapping", () => {
  it("loginErrorMessage", () => {
    expect(loginErrorMessage(401, "invalid_credentials")).toBe("wrong email or password");
    for (const [s, c] of [
      [400, "turnstile_required"],
      [400, "turnstile_failed"],
      [429, undefined],
      [400, "rate_limited"],
    ] as const) {
      expect(loginErrorMessage(s, c)).toContain("https://simap.mmlabs.online");
    }
    expect(loginErrorMessage(500, "boom_x")).toBe("sign-in failed (HTTP 500, boom_x)");
    expect(loginErrorMessage(500, "Evil <script>")).toBe("sign-in failed (HTTP 500, unknown)");
  });

  it("tokenErrorMessage", () => {
    expect(tokenErrorMessage(403, "not_member")).toMatch(/not a member/);
    expect(tokenErrorMessage(403, "org_access_denied")).toMatch(/denied/);
    expect(tokenErrorMessage(403, "email_unverified")).toMatch(/not verified/);
    expect(tokenErrorMessage(500, "x")).toBe("token request failed (HTTP 500, x)");
  });
});

describe("token file", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "simap-dev-token-script-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("tokenFilePath default and override", () => {
    expect(tokenFilePath({}, join("h", "u"))).toBe(join("h", "u", ".config", "simap", "dev-token"));
    expect(tokenFilePath({ SIMAP_DEV_TOKEN_FILE: "/x/t" }, "h")).toBe("/x/t");
  });

  it("assertOutsideRepo refuses a path inside the repo, accepts the home default", () => {
    const repo = join(dir, "repo");
    expect(() => assertOutsideRepo(join(repo, "a", "t"), repo)).toThrow(/inside the repository/);
    expect(() => assertOutsideRepo(repo, repo)).toThrow(/inside the repository/);
    expect(() => assertOutsideRepo(join(dir, "home", ".config", "simap", "t"), repo)).not.toThrow();
    expect(() =>
      assertOutsideRepo(join(repo, "a").toUpperCase(), repo.toLowerCase(), "win32"),
    ).toThrow();
  });

  it("writeTokenFile writes token + newline atomically, mode 0600 on POSIX", () => {
    const f = join(dir, "sub", "dev-token");
    writeTokenFile(f, "a.b.c");
    expect(readFileSync(f, "utf8")).toBe("a.b.c\n");
    expect(readdirSync(join(dir, "sub"))).toEqual(["dev-token"]);
    if (process.platform !== "win32") expect(statSync(f).mode & 0o777).toBe(0o600);
  });
});

describe("run", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "simap-dev-token-run-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const setup = (
    opts: { org?: string | null; logoutFails?: boolean; tokenClaims?: object } = {},
  ) => {
    const token = jwt({ exp: 9_999_999_999, ...(opts.tokenClaims ?? { org: ORG }) });
    const calls: Array<{ url: string; init: RequestInit; body: Record<string, unknown> }> = [];
    const fetchFn = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init, body: JSON.parse(String(init.body)) });
      if (url.endsWith("/auth/login")) {
        const h = new Headers();
        h.append("Set-Cookie", "sid=abc; Path=/; HttpOnly");
        return new Response(JSON.stringify({ account_id: ACC }), { status: 200, headers: h });
      }
      if (url.endsWith("/auth/token")) {
        return Response.json({
          access_token: token,
          token_type: "Bearer",
          audience: "simap",
          expires_in: 43200,
        });
      }
      if (opts.logoutFails) throw new Error("down");
      return new Response(null, { status: 204 });
    });
    const out: string[] = [];
    const err: string[] = [];
    const file = join(dir, "t", "dev-token");
    const go = () =>
      run({
        fetchFn,
        promptEmail: async () => "me@example.com",
        promptPassword: async () => PASSWORD,
        env: { SIMAP_DEV_TOKEN_FILE: file },
        out: (m: string) => out.push(m),
        err: (m: string) => err.push(m),
        argv: opts.org ? ["--org", opts.org] : [],
        repoRoot: join(dir, "repo"),
      });
    return { go, calls, out, err, file, token };
  };

  it("signs in, requests the token, forwards the cookie, logs out, never prints secrets", async () => {
    const t = setup({ org: ORG });
    expect(await t.go()).toBe(0);
    const [login, tok, logout] = t.calls;
    expect(login.body).toEqual({ email: "me@example.com", password: PASSWORD });
    for (const c of t.calls) {
      const h = c.init.headers as Record<string, string>;
      expect(h.Origin).toBe("https://simap.mmlabs.online");
      expect(h["X-MM-App"]).toBe("simap");
      expect(c.init.redirect).toBe("manual");
    }
    expect(tok.body).toEqual({ audience: "simap", account_id: ACC, org_id: ORG });
    expect((tok.init.headers as Record<string, string>).Cookie).toBe("sid=abc");
    expect(logout.url).toMatch(/\/auth\/logout$/);
    expect(readFileSync(t.file, "utf8")).toBe(`${t.token}\n`);
    const printed = [...t.out, ...t.err].join("\n");
    expect(printed).not.toContain(PASSWORD);
    expect(printed).not.toContain(t.token);
    expect(printed).toContain("valid for 43200s");
  });

  it("ignores a logout failure", async () => {
    const t = setup({ org: ORG, logoutFails: true });
    expect(await t.go()).toBe(0);
  });

  it("without an org it writes the token and prints the --org hint", async () => {
    const t = setup({ tokenClaims: {} });
    expect(await t.go()).toBe(0);
    expect(t.calls[1].body).toEqual({ audience: "simap", account_id: ACC });
    expect(t.out.join("\n")).toContain("re-run with --org <uuid>");
  });

  it("refuses a token file inside the repo", async () => {
    const t = setup();
    const code = await run({
      fetchFn: vi.fn(),
      promptEmail: async () => "x",
      promptPassword: async () => PASSWORD,
      env: { SIMAP_DEV_TOKEN_FILE: join(dir, "repo", "tok") },
      out: () => {},
      err: (m: string) => t.err.push(m),
      argv: [],
      repoRoot: join(dir, "repo"),
    });
    expect(code).toBe(1);
    expect(t.err.join("")).toContain("inside the repository");
  });
});
