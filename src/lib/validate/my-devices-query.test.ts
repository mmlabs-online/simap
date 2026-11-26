import { describe, expect, it } from "vitest";
import { encodeMyDevicesCursor } from "@/lib/devices/cursor";
import { parseMyDevicesQuery } from "./my-devices-query";

const q = (s: string) => parseMyDevicesQuery(new URLSearchParams(s));
const CURSOR = { k: "đèn", id: "0b0e0a4e-8f1c-4f5e-9d3a-1c2b3d4e5f60" };

describe("parseMyDevicesQuery", () => {
  it("defaults to 50; accepts 1 and 100; rejects 0, 101, abc, duplicates", () => {
    expect(q("")).toEqual({ ok: true, value: { limit: 50 } });
    expect(q("limit=1")).toEqual({ ok: true, value: { limit: 1 } });
    expect(q("limit=100")).toEqual({ ok: true, value: { limit: 100 } });
    for (const bad of ["limit=0", "limit=101", "limit=abc", "limit=1&limit=2"]) {
      expect(q(bad)).toEqual({ ok: false, field: "limit" });
    }
  });

  it("accepts its own cursor; rejects a bad or repeated cursor; blank = absent", () => {
    const c = encodeMyDevicesCursor(CURSOR);
    expect(q(`cursor=${c}`)).toEqual({ ok: true, value: { limit: 50, cursor: CURSOR } });
    expect(q("cursor=")).toEqual({ ok: true, value: { limit: 50 } });
    for (const bad of ["cursor=!!!", `cursor=${c}&cursor=${c}`]) {
      expect(q(bad)).toEqual({ ok: false, field: "cursor" });
    }
  });
});
