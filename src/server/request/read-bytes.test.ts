import { describe, expect, it } from "vitest";
import { readBytes } from "./read-bytes";

const req = (body: BodyInit | null, headers: Record<string, string> = {}) =>
  new Request("http://x/", {
    method: "PUT",
    body,
    headers: { "content-type": "image/png", ...headers },
  });

describe("readBytes", () => {
  it("wrong or missing type gives type", async () => {
    const wrong = new Request("http://x/", {
      method: "PUT",
      body: "x",
      headers: { "content-type": "text/plain" },
    });
    expect(await readBytes(wrong, 10, "image/png")).toEqual({ ok: false, reason: "type" });
    const none = new Request("http://x/", { method: "PUT", body: new Uint8Array([1]) });
    none.headers.delete("content-type");
    expect(await readBytes(none, 10, "image/png")).toEqual({ ok: false, reason: "type" });
  });

  it("accepts a mixed-case type with parameters", async () => {
    const r = await readBytes(
      req(new Uint8Array([1, 2]), { "content-type": "Image/PNG; foo=bar" }),
      10,
      "image/png",
    );
    expect(r).toEqual({ ok: true, bytes: new Uint8Array([1, 2]) });
  });

  it("declared content-length over the cap is refused without reading", async () => {
    let pulled = false;
    const body = new ReadableStream(
      {
        pull() {
          pulled = true;
        },
      },
      { highWaterMark: 0 },
    );
    const r = new Request("http://x/", {
      method: "PUT",
      body,
      headers: { "content-type": "image/png", "content-length": "20481" },
      // @ts-expect-error node fetch needs duplex for stream bodies
      duplex: "half",
    });
    expect(await readBytes(r, 20480, "image/png")).toEqual({ ok: false, reason: "too_large" });
    expect(pulled).toBe(false);
  });

  it("a streamed body over the cap is too_large and the reader is cancelled", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        c.enqueue(new Uint8Array(6));
      },
      cancel() {
        cancelled = true;
      },
    });
    const r = new Request("http://x/", {
      method: "PUT",
      body,
      headers: { "content-type": "image/png" },
      // @ts-expect-error node fetch needs duplex for stream bodies
      duplex: "half",
    });
    expect(await readBytes(r, 10, "image/png")).toEqual({ ok: false, reason: "too_large" });
    expect(cancelled).toBe(true);
  });

  it("exactly the cap is ok", async () => {
    const r = await readBytes(req(new Uint8Array(20480)), 20480, "image/png");
    expect(r.ok && r.bytes.length).toBe(20480);
  });

  it("no body or 0 bytes is empty", async () => {
    expect(await readBytes(req(null), 10, "image/png")).toEqual({ ok: false, reason: "empty" });
    expect(await readBytes(req(new Uint8Array(0)), 10, "image/png")).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("a stream that errors gives read; chunks are joined in order", async () => {
    const bad = new ReadableStream<Uint8Array>({
      start(c) {
        c.error(new Error("boom"));
      },
    });
    const r1 = new Request("http://x/", {
      method: "PUT",
      body: bad,
      headers: { "content-type": "image/png" },
      // @ts-expect-error node fetch needs duplex for stream bodies
      duplex: "half",
    });
    expect(await readBytes(r1, 10, "image/png")).toEqual({ ok: false, reason: "read" });
    const parts = [new Uint8Array([1, 2]), new Uint8Array([3]), new Uint8Array([4, 5])];
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        for (const p of parts) c.enqueue(p);
        c.close();
      },
    });
    const r2 = new Request("http://x/", {
      method: "PUT",
      body,
      headers: { "content-type": "image/png" },
      // @ts-expect-error node fetch needs duplex for stream bodies
      duplex: "half",
    });
    expect(await readBytes(r2, 10, "image/png")).toEqual({
      ok: true,
      bytes: new Uint8Array([1, 2, 3, 4, 5]),
    });
  });
});
