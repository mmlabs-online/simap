import { describe, expect, it } from "vitest";
import { encodeMemberCursor } from "@/lib/members/cursor";
import { parseMemberQuery } from "./member-query";

const p = (s: string) => parseMemberQuery(new URLSearchParams(s));
const ID = "33333333-3333-4333-8333-333333333333";

describe("parseMemberQuery", () => {
  it("defaults: status active, limit 50, no q", () => {
    expect(p("")).toEqual({ ok: true, value: { status: "active", limit: 50 } });
  });
  it("q is trimmed, NFC, whitespace collapsed; blank is absent; 81 code points is an error", () => {
    const decomposed = "Nguyễn   Van ";
    expect(p("q=" + encodeURIComponent(decomposed))).toEqual({
      ok: true,
      value: { status: "active", limit: 50, q: "Nguyễn Van" },
    });
    expect(p("q=%20%20")).toEqual({ ok: true, value: { status: "active", limit: 50 } });
    expect(p("q=" + "a".repeat(80)).ok).toBe(true);
    expect(p("q=" + "a".repeat(81))).toEqual({ ok: false, field: "q" });
  });
  it("status enum", () => {
    for (const s of ["active", "deactivated", "all"]) expect(p("status=" + s).ok).toBe(true);
    expect(p("status=banana")).toEqual({ ok: false, field: "status" });
  });
  it("limit bounds", () => {
    expect(p("limit=100")).toMatchObject({ ok: true, value: { limit: 100 } });
    for (const l of ["0", "101", "01", "1e2", "-1", "x"]) {
      expect(p("limit=" + l)).toEqual({ ok: false, field: "limit" });
    }
  });
  it("duplicated params are errors", () => {
    for (const k of ["q=a&q=b", "status=all&status=all", "limit=1&limit=2", "cursor=a&cursor=a"]) {
      expect(p(k).ok).toBe(false);
    }
  });
  it("cursor: valid decodes, bad is an error; unknown params ignored", () => {
    const c = encodeMemberCursor({ k: "a", id: ID });
    expect(p("cursor=" + c + "&zzz=1")).toMatchObject({
      ok: true,
      value: { cursor: { k: "a", id: ID } },
    });
    expect(p("cursor=!!")).toEqual({ ok: false, field: "cursor" });
  });
});
