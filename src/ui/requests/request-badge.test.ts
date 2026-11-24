import { describe, expect, it } from "vitest";
import { shellCopy } from "../copy/shell";
import { badgeText, mergeNewIds, newestDecidedAt } from "./request-badge";

const row = (id: string, isNew: boolean, decidedAt: string | null) => ({ id, isNew, decidedAt });

describe("newestDecidedAt", () => {
  it("max decidedAt among isNew rows only; ignores isNew false and decidedAt null; null when none", () => {
    expect(
      newestDecidedAt([
        row("1", true, "2026-03-05T10:00:00.000000Z"),
        row("2", true, "2026-03-05T12:00:00.000000Z"),
        row("3", false, "2026-03-06T12:00:00.000000Z"),
        row("4", true, null),
      ]),
    ).toBe("2026-03-05T12:00:00.000000Z");
    expect(newestDecidedAt([])).toBeNull();
    expect(newestDecidedAt([row("1", false, "2026-03-05T10:00:00.000000Z")])).toBeNull();
    expect(newestDecidedAt([row("1", true, null)])).toBeNull();
  });
  it("compares as strings and keeps microseconds verbatim", () => {
    const a = "2026-03-05T10:00:12.123456Z";
    const b = "2026-03-05T10:00:12.123457Z";
    expect(new Date(a).getTime()).toBe(new Date(b).getTime());
    expect(newestDecidedAt([row("1", true, a), row("2", true, b)])).toBe(b);
    expect(newestDecidedAt([row("2", true, b), row("1", true, a)])).toBe(b);
  });
  it("with after: null when nothing is newer; the newer value when one is", () => {
    const old = "2026-03-05T10:00:00.000000Z";
    const next = "2026-03-05T10:00:00.000001Z";
    expect(newestDecidedAt([row("1", true, old)], old)).toBeNull();
    expect(newestDecidedAt([row("1", true, old)], next)).toBeNull();
    expect(newestDecidedAt([row("1", true, next)], old)).toBe(next);
    expect(newestDecidedAt([row("1", true, old)], null)).toBe(old);
  });
});

describe("mergeNewIds", () => {
  it("adds ids of isNew rows, keeps earlier ids even when a later page reports isNew false", () => {
    const first = mergeNewIds(new Set(), [row("1", true, "x"), row("2", false, "y")]);
    expect([...first]).toEqual(["1"]);
    const second = mergeNewIds(first, [row("1", false, "x"), row("3", true, "z")]);
    expect([...second].sort()).toEqual(["1", "3"]);
  });
  it("returns the same set when nothing is added", () => {
    const prev = new Set(["1"]);
    expect(mergeNewIds(prev, [row("1", true, "x"), row("2", false, "y")])).toBe(prev);
  });
});

describe("badgeText", () => {
  it("0 and negatives -> null; 1..9 -> the number; 10 and 120 -> the overflow text", () => {
    expect(badgeText(0)).toBeNull();
    expect(badgeText(-3)).toBeNull();
    expect(badgeText(1)).toBe("1");
    expect(badgeText(9)).toBe("9");
    expect(badgeText(10)).toBe("9+");
    expect(badgeText(120)).toBe(shellCopy.badge.overflow);
  });
});
