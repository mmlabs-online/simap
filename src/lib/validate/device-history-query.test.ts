import { describe, expect, it } from "vitest";
import { encodeCursor } from "@/lib/audit/cursor";
import { parseDeviceHistoryQuery } from "./device-history-query";

const q = (s: string) => parseDeviceHistoryQuery(new URLSearchParams(s));
const CURSOR = { at: "2026-03-05T17:30:00.123456Z", id: "0b0e0a4e-8f1c-4f5e-9d3a-1c2b3d4e5f60" };

describe("parseDeviceHistoryQuery", () => {
  it("default limit 50; limit 1 and 100 ok; 0, 101, 1.5, -1, abc, repeated -> field limit", () => {
    expect(q("")).toEqual({ ok: true, value: { limit: 50 } });
    expect(q("limit=1")).toEqual({ ok: true, value: { limit: 1 } });
    expect(q("limit=100")).toEqual({ ok: true, value: { limit: 100 } });
    for (const bad of [
      "limit=0",
      "limit=101",
      "limit=1.5",
      "limit=-1",
      "limit=abc",
      "limit=1&limit=2",
    ]) {
      expect(q(bad)).toEqual({ ok: false, field: "limit" });
    }
  });

  it("a cursor from encodeCursor is accepted; garbage, wrong keys, millisecond time, repeated -> field cursor; blank = absent", () => {
    const c = encodeCursor(CURSOR);
    expect(q(`cursor=${c}`)).toEqual({ ok: true, value: { limit: 50, cursor: CURSOR } });
    expect(q("cursor=")).toEqual({ ok: true, value: { limit: 50 } });
    const wrongKeys = Buffer.from(JSON.stringify({ at: CURSOR.at }), "utf8").toString("base64url");
    const ms = encodeCursor({ ...CURSOR, at: "2026-03-05T17:30:00.123Z" });
    for (const bad of [
      "cursor=!!!",
      `cursor=${wrongKeys}`,
      `cursor=${ms}`,
      `cursor=${c}&cursor=${c}`,
    ]) {
      expect(q(bad)).toEqual({ ok: false, field: "cursor" });
    }
  });
});
