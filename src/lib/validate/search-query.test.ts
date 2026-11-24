import { describe, expect, it } from "vitest";
import { encodeSearchCursor } from "@/lib/search/cursor";
import { parseSearchQuery } from "./search-query";

const p = (s: string) => parseSearchQuery(new URLSearchParams(s));
const ID = "33333333-3333-4333-8333-333333333333";

describe("parseSearchQuery", () => {
  it("defaults: kind all, limit 20; q NFC, whitespace collapsed, trimmed", () => {
    expect(p("q=" + encodeURIComponent("  Nguyễn   Van "))).toEqual({
      ok: true,
      value: { q: "Nguyễn Van", folded: "nguyen van", kind: "all", limit: 20 },
    });
  });
  it("q missing, blank, 81 chars, only combining marks -> field q; 80 Vietnamese chars ok", () => {
    for (const s of ["", "q=", "q=%20%20", "q=" + "a".repeat(81), "q=%CC%81", "q=a&q=b"]) {
      expect(p(s), s).toEqual({ ok: false, field: "q" });
    }
    expect(p("q=" + encodeURIComponent("ễ".repeat(80))).ok).toBe(true);
  });
  it("limit 0, 51, abc, 1e1 -> field limit; 1 and 50 ok", () => {
    for (const l of ["0", "51", "abc", "1e1", "-1", "01"]) {
      expect(p("q=a&limit=" + l)).toEqual({ ok: false, field: "limit" });
    }
    expect(p("q=a&limit=1")).toMatchObject({ ok: true, value: { limit: 1 } });
    expect(p("q=a&limit=50")).toMatchObject({ ok: true, value: { limit: 50 } });
  });
  it("kind unknown -> field kind; duplicates of any param -> that field", () => {
    expect(p("q=a&kind=room")).toEqual({ ok: false, field: "kind" });
    expect(p("q=a&kind=seat&kind=device")).toEqual({ ok: false, field: "kind" });
    expect(p("q=a&limit=1&limit=2")).toEqual({ ok: false, field: "limit" });
    expect(p("q=a&kind=seat&cursor=x&cursor=y")).toEqual({ ok: false, field: "cursor" });
    for (const k of ["all", "seat", "device", "member"]) expect(p("q=a&kind=" + k).ok).toBe(true);
  });
  it("cursor with kind=all, cursor of another kind, garbage -> field cursor", () => {
    const c = encodeSearchCursor({ t: "seat", k: "a", id: ID });
    expect(p(`q=a&cursor=${c}`)).toEqual({ ok: false, field: "cursor" });
    expect(p(`q=a&kind=device&cursor=${c}`)).toEqual({ ok: false, field: "cursor" });
    expect(p("q=a&kind=seat&cursor=!!!")).toEqual({ ok: false, field: "cursor" });
    expect(p(`q=a&kind=seat&cursor=${c}`)).toMatchObject({
      ok: true,
      value: { kind: "seat", cursor: { t: "seat", k: "a", id: ID } },
    });
  });
});
