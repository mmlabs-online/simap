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

  const streamReq = (chunks: Uint8Array[], extra: HeadersInit = {}) => {
    const state = { pulled: 0, cancelled: false };
    const body = new ReadableStream<Uint8Array>({
      pull(ctrl) {
        const c = chunks[state.pulled++];
        if (c) ctrl.enqueue(c);
        else ctrl.close();
      },
      cancel() {
        state.cancelled = true;
      },
    });
    const r = new Request("http://x/api", {
      method: "POST",
      body,
      duplex: "half",
      headers: { "content-type": "application/json", ...extra },
    } as RequestInit);
    return { r, state };
  };
  const manyChunks = () => Array.from({ length: 100 }, () => new Uint8Array(4096).fill(0x20));

  it("stream over the cap without content-length -> not ok and cancelled", async () => {
    const { r, state } = streamReq(manyChunks());
    expect(await readJson(r)).toEqual({ ok: false });
    expect(state.cancelled).toBe(true);
    expect(state.pulled).toBeLessThan(100);
  });

  it("lying small content-length with a stream -> not ok and cancelled", async () => {
    const { r, state } = streamReq(manyChunks(), { "content-length": "5" });
    expect(await readJson(r)).toEqual({ ok: false });
    expect(state.cancelled).toBe(true);
    expect(state.pulled).toBeLessThan(100);
  });

  it("invalid UTF-8 -> not ok", async () => {
    const bytes = new Uint8Array([0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xc3, 0x28, 0x22, 0x7d]);
    expect(await readJson(streamReq([bytes]).r)).toEqual({ ok: false });
  });

  it("exactly maxBytes is accepted; maxBytes+1 is refused; split multi-byte char reassembles", async () => {
    const enc = new TextEncoder();
    const exact = enc.encode('{"a":"' + "x".repeat(20) + '"}');
    expect(await readJson(streamReq([exact]).r, exact.length)).toMatchObject({ ok: true });
    expect(await readJson(streamReq([exact]).r, exact.length - 1)).toEqual({ ok: false });
    const e = enc.encode('{"a":"éé"}');
    const cut = e.indexOf(0xc3) + 1;
    const r = await readJson(streamReq([e.slice(0, cut), e.slice(cut)]).r);
    expect(r).toEqual({ ok: true, body: { a: "éé" } });
  });

  it("empty or missing body -> not ok", async () => {
    const r = new Request("http://x/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    expect(await readJson(r)).toEqual({ ok: false });
  });
});
