import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { devAuthorization, readDevTokenFile, tokenFilePath } from "./dev-token";

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (expSec: number) => `${b64({ alg: "ES256" })}.${b64({ exp: expSec })}.sig`;
const future = () => jwt(Math.floor(Date.now() / 1000) + 3600);

let dir: string;
let file: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "simap-dev-token-"));
  file = join(dir, "dev-token");
  vi.stubEnv("SIMAP_DEV_TOKEN_FILE", file);
  globalThis.__simapDevTokenWarn = undefined;
});
afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.__simapDevTokenWarn = undefined;
  rmSync(dir, { recursive: true, force: true });
});

const apiReq = (headers: Record<string, string> = {}) =>
  new Request("http://localhost:3000/api/me", { headers: { host: "localhost:3000", ...headers } });

describe("tokenFilePath", () => {
  it("defaults to ~/.config/simap/dev-token and honours SIMAP_DEV_TOKEN_FILE", () => {
    expect(tokenFilePath({}, join("h", "u"))).toBe(join("h", "u", ".config", "simap", "dev-token"));
    expect(tokenFilePath({ SIMAP_DEV_TOKEN_FILE: "/x/t" }, "h")).toBe("/x/t");
  });
});

describe("readDevTokenFile", () => {
  it("missing file -> missing; a rewritten file is picked up on the next call", () => {
    expect(readDevTokenFile(file, Date.now())).toEqual({ status: "missing" });
    const t1 = future();
    writeFileSync(file, `${t1}\n`);
    expect(readDevTokenFile(file, Date.now())).toEqual({ status: "ok", token: t1 });
    const t2 = future() + "x";
    writeFileSync(file, `${t2}\n`);
    expect(readDevTokenFile(file, Date.now())).toEqual({ status: "ok", token: t2 });
  });
});

describe("devAuthorization", () => {
  it("returns Bearer <file token> for a same-origin localhost /api request", () => {
    const t = future();
    writeFileSync(file, t);
    expect(devAuthorization(apiReq({ "sec-fetch-site": "same-origin" }))).toBe(`Bearer ${t}`);
    expect(
      devAuthorization(apiReq({ authorization: "Bearer client", "sec-fetch-site": "same-origin" })),
    ).toBe(`Bearer ${t}`);
  });

  it("returns null for cross-site requests", () => {
    writeFileSync(file, future());
    expect(devAuthorization(apiReq({ "sec-fetch-site": "cross-site" }))).toBeNull();
  });

  it("two requests with a missing file warn once, and the warning never contains a token", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(devAuthorization(apiReq())).toBeNull();
    expect(devAuthorization(apiReq())).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("pnpm dev:token");
  });
});
