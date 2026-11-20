import { describe, expect, it } from "vitest";
import { readJson } from "./read-json";

const req = (body: string, type: string | null = "application/json", extra: HeadersInit = {}) =>
  new Request("http://x/api", {
    method: "POST",
    body,
    headers: { ...(type ? { "content-type": type } : {}), ...extra },
  });

describe("readJson", () => {
  it("valid JSON -> ok (charset parameter allowed)", async () => {
    expect(await readJson(req('{"a":1}', "application/json; charset=utf-8"))).toEqual({
      ok: true,
      body: { a: 1 },
    });
  });

  it("wrong or missing content type -> not ok", async () => {
    expect(await readJson(req("{}", "text/plain"))).toEqual({ ok: false });
    expect(await readJson(req("{}", null))).toEqual({ ok: false });
  });

  it("invalid JSON -> not ok", async () => {
    expect(await readJson(req("{nope"))).toEqual({ ok: false });
  });

  it("body over the cap -> not ok", async () => {
    const big = JSON.stringify({ a: "x".repeat(16_400) });
    expect(await readJson(req(big))).toEqual({ ok: false });
    expect(await readJson(req(big), 100_000)).toMatchObject({ ok: true });
  });

  it("a lying small content-length does not bypass the cap", async () => {
    const big = JSON.stringify({ a: "x".repeat(16_400) });
    expect(await readJson(req(big, "application/json", { "content-length": "5" }))).toEqual({
      ok: false,
    });
  });
});
