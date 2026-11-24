import { describe, expect, it } from "vitest";
import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import { createExportApi, filenameFromDisposition } from "./export-api";

const apiWith = (respond: () => Response | Promise<Response>) =>
  createExportApi((async () => respond()) as unknown as ApiFetch);

describe("export-api download", () => {
  it("resolves blob, filename from Content-Disposition and truncated flag", async () => {
    const calls: string[] = [];
    const api = createExportApi((async (p: string) => {
      calls.push(p);
      return new Response("﻿A\r\n", {
        headers: {
          "content-disposition": 'attachment; filename="simap-seats-20261124.csv"',
          "x-export-truncated": "true",
        },
      });
    }) as unknown as ApiFetch);
    const r = await api.download("seats");
    expect(calls).toEqual(["/api/export/seats"]);
    expect(r).toMatchObject({ ok: true, filename: "simap-seats-20261124.csv", truncated: true });
    if (r.ok)
      expect([...new Uint8Array(await r.blob.arrayBuffer()).slice(0, 3)]).toEqual([
        0xef, 0xbb, 0xbf,
      ]);
  });

  it("falls back to simap-<kind>.csv when the header is missing or odd", async () => {
    const r = await apiWith(() => new Response("x")).download("devices");
    expect(r).toMatchObject({ ok: true, filename: "simap-devices.csv", truncated: false });
    expect(filenameFromDisposition('attachment; filename="../x.csv"')).toBeNull();
    expect(filenameFromDisposition(null)).toBeNull();
  });

  it("maps 403 ApiAccessError and non-ok responses to {ok:false, code}", async () => {
    const denied = createExportApi((async () => {
      throw new ApiAccessError("forbidden");
    }) as unknown as ApiFetch);
    expect(await denied.download("members")).toEqual({ ok: false, code: "forbidden" });
    const out = createExportApi((async () => {
      throw new ApiAccessError("signed_out");
    }) as unknown as ApiFetch);
    expect(await out.download("members")).toEqual({ ok: false, code: "unauthenticated" });
    const net = createExportApi((async () => {
      throw new TypeError("net");
    }) as unknown as ApiFetch);
    expect(await net.download("members")).toEqual({ ok: false, code: "unavailable" });
    const bad = apiWith(
      () => new Response(JSON.stringify({ error: { code: "unavailable" } }), { status: 503 }),
    );
    expect(await bad.download("seats")).toEqual({ ok: false, code: "unavailable" });
    expect(await apiWith(() => new Response("x", { status: 500 })).download("seats")).toEqual({
      ok: false,
      code: "internal",
    });
  });
});
