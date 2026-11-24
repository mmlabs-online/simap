import { describe, expect, it } from "vitest";
import { encodeCursor } from "@/lib/audit/cursor";
import { parseMyRequestsQuery, parseRequestListQuery } from "./request-query";

const q = (s: string) => new URLSearchParams(s);
const CUR = { at: "2026-11-24T05:00:00.123456Z", id: "33333333-3333-4333-8333-333333333333" };

describe("parseRequestListQuery: status", () => {
  it("no params -> pending, limit 50", () => {
    expect(parseRequestListQuery(q(""))).toEqual({
      ok: true,
      value: { status: "pending", limit: 50 },
    });
  });

  it("accepts each status; blank status -> pending", () => {
    for (const s of ["pending", "approved", "rejected", "cancelled"]) {
      expect(parseRequestListQuery(q(`status=${s}`))).toEqual({
        ok: true,
        value: { status: s, limit: 50 },
      });
    }
    expect(parseRequestListQuery(q("status="))).toEqual({
      ok: true,
      value: { status: "pending", limit: 50 },
    });
  });

  it("refuses an unknown or repeated status", () => {
    for (const s of ["status=nope", "status=pending&status=approved", "status=Pending"]) {
      expect(parseRequestListQuery(q(s))).toEqual({ ok: false, field: "status" });
    }
  });
});

describe.each([
  ["list", (s: string) => parseRequestListQuery(q(s))],
  ["mine", (s: string) => parseMyRequestsQuery(q(s))],
])("%s: limit and cursor", (_name, parse) => {
  it("limit 1 and 100 ok; blank -> default", () => {
    expect(parse("limit=1")).toMatchObject({ ok: true, value: { limit: 1 } });
    expect(parse("limit=100")).toMatchObject({ ok: true, value: { limit: 100 } });
    expect(parse("limit=")).toMatchObject({ ok: true, value: { limit: 50 } });
  });

  it("refuses 0, 101, 01, 1.5, -1 and a repeated limit", () => {
    for (const s of ["0", "101", "01", "1.5", "-1", "1&limit=2"]) {
      expect(parse(`limit=${s}`)).toEqual({ ok: false, field: "limit" });
    }
  });

  it("cursor round-trips", () => {
    expect(parse(`cursor=${encodeCursor(CUR)}`)).toMatchObject({
      ok: true,
      value: { cursor: CUR },
    });
  });

  it("refuses garbage, wrong keys, ms-form at and a repeated cursor", () => {
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const bad = [
      "!!!",
      b64({ at: CUR.at }),
      b64({ at: "2026-11-24T05:00:00.123Z", id: CUR.id }),
      `${encodeCursor(CUR)}&cursor=${encodeCursor(CUR)}`,
    ];
    for (const c of bad) expect(parse(`cursor=${c}`)).toEqual({ ok: false, field: "cursor" });
  });
});

describe("parseMyRequestsQuery: status", () => {
  it("status is ignored", () => {
    expect(parseMyRequestsQuery(q("status=approved"))).toEqual({ ok: true, value: { limit: 50 } });
  });
});
