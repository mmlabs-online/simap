import { describe, expect, it } from "vitest";
import { encodeCursor } from "@/lib/audit/cursor";
import { parseAuditQuery } from "./audit-query";

const ID = "33333333-3333-4333-8333-333333333333";
const p = (q: string) => parseAuditQuery(new URLSearchParams(q));
const bad = (q: string, field: string) => expect(p(q)).toEqual({ ok: false, field });

describe("parseAuditQuery", () => {
  it("empty params -> defaults (limit 50, nothing else)", () => {
    expect(p("")).toEqual({ ok: true, value: { limit: 50 } });
  });

  it("limit: 1 and 100 ok; 0, 101, -1, 1.5, '10abc', ' 5', '1e2' -> field limit", () => {
    expect(p("limit=1")).toEqual({ ok: true, value: { limit: 1 } });
    expect(p("limit=100")).toEqual({ ok: true, value: { limit: 100 } });
    for (const v of ["0", "101", "-1", "1.5", "10abc", "%205", "1e2"]) bad(`limit=${v}`, "limit");
  });

  it("actor: canonical uuid ok; uppercase, nil uuid, 'x', padded -> field actor", () => {
    expect(p(`actor=${ID}`)).toEqual({ ok: true, value: { limit: 50, actor: ID } });
    for (const v of [
      "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
      "00000000-0000-0000-0000-000000000000",
      "x",
      `%20${ID}`,
    ]) {
      bad(`actor=${v}`, "actor");
    }
  });

  it("entity: 'room' ok; 'Room', 'room;drop', 65 chars, 'phòng' -> field entity", () => {
    expect(p("entity=room")).toEqual({ ok: true, value: { limit: 50, entity: "room" } });
    for (const v of ["Room", "room;drop", "a".repeat(65), "phòng"]) bad(`entity=${v}`, "entity");
  });

  it("from/to: valid Z instant ok; date-only, '+07:00' offset, 'not a date', '2026-02-30T00:00:00Z' -> field from/to", () => {
    expect(p("from=2026-11-20T00:00:00Z")).toEqual({
      ok: true,
      value: { limit: 50, from: "2026-11-20T00:00:00.000Z" },
    });
    expect(p("to=2026-11-20T00:00:00.500Z")).toEqual({
      ok: true,
      value: { limit: 50, to: "2026-11-20T00:00:00.500Z" },
    });
    for (const f of ["from", "to"]) {
      for (const v of [
        "2026-11-20",
        "2026-11-20T00:00:00%2B07:00",
        "not a date",
        "2026-02-30T00:00:00Z",
      ]) {
        bad(`${f}=${v}`, f);
      }
    }
  });

  it("from >= to -> field to; from == to rejected; from < to ok", () => {
    bad("from=2026-11-20T00:00:00Z&to=2026-11-19T00:00:00Z", "to");
    bad("from=2026-11-20T00:00:00Z&to=2026-11-20T00:00:00Z", "to");
    expect(p("from=2026-11-20T00:00:00Z&to=2026-11-20T00:00:01Z").ok).toBe(true);
  });

  it("repeated param (`actor=a&actor=b`) -> invalid", () => {
    bad(`actor=${ID}&actor=${ID}`, "actor");
    bad("limit=1&limit=2", "limit");
    bad("entity=a&entity=b", "entity");
  });

  it("empty string value treated as absent", () => {
    expect(p("actor=&entity=&from=&to=&limit=&cursor=")).toEqual({
      ok: true,
      value: { limit: 50 },
    });
  });

  it("bad cursor -> field cursor", () => {
    bad("cursor=garbage", "cursor");
  });

  it("all filters together parse into one AuditFilter", () => {
    const cursor = { at: "2026-11-20T08:46:02.123456Z", id: ID };
    const q = new URLSearchParams({
      actor: ID,
      entity: "room",
      from: "2026-11-01T00:00:00Z",
      to: "2026-11-20T00:00:00Z",
      limit: "25",
      cursor: encodeCursor(cursor),
      org: "ignored",
    });
    expect(parseAuditQuery(q)).toEqual({
      ok: true,
      value: {
        actor: ID,
        entity: "room",
        from: "2026-11-01T00:00:00.000Z",
        to: "2026-11-20T00:00:00.000Z",
        limit: 25,
        cursor,
      },
    });
  });
});
