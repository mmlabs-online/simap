import { describe, expect, it } from "vitest";
import { parseMemberQuery } from "@/lib/validate/member-query";
import {
  blocksSearchEnter,
  canLoadMore,
  INITIAL_PICKER,
  normalizePickerQuery,
  pickerReducer,
  selectedMember,
  type PickerEvent,
  type PickerMember,
  type PickerState,
} from "./member-picker";

const m = (id: string, name = id): PickerMember => ({ id, displayName: name, employeeCode: null });
const page = (items: PickerMember[], nextCursor: string | null) => ({
  ok: true as const,
  value: { items, nextCursor },
});
const run = (events: PickerEvent[], from: PickerState = INITIAL_PICKER) =>
  events.reduce(pickerReducer, from);

describe("normalizePickerQuery", () => {
  it("NFC, collapses whitespace, trims", () => {
    expect(normalizePickerQuery("  Nguyễn \t  An ")).toBe("Nguyễn An");
  });
  it("caps at 80 code points and never splits a surrogate pair", () => {
    const out = normalizePickerQuery("😀".repeat(100));
    expect([...out]).toHaveLength(80);
    expect(out).toBe("😀".repeat(80));
  });
  it("always passes parseMemberQuery", () => {
    for (const raw of ["a ".repeat(100), "  x  ", "😀 ".repeat(60), "é".repeat(90)]) {
      const q = normalizePickerQuery(raw);
      const params = new URLSearchParams({ q });
      expect(parseMemberQuery(params).ok).toBe(true);
    }
  });
});

describe("pickerReducer", () => {
  it("search resets items, cursor and selection", () => {
    const loaded = run([
      { type: "search", id: 1 },
      { type: "loaded", id: 1, result: page([m("a")], "c1") },
      { type: "select", memberId: "a" },
    ]);
    const next = pickerReducer(loaded, { type: "search", id: 2 });
    expect(next).toMatchObject({
      items: [],
      nextCursor: null,
      selectedId: null,
      status: "loading",
      latest: 2,
    });
  });
  it("a stale search response is dropped", () => {
    const s = run([
      { type: "search", id: 1 },
      { type: "search", id: 2 },
      { type: "loaded", id: 1, result: page([m("old")], null) },
    ]);
    expect(s.items).toEqual([]);
    expect(s.status).toBe("loading");
  });
  it("a load-more response from an older query is dropped, never appended", () => {
    const s = run([
      { type: "search", id: 1 },
      { type: "loaded", id: 1, result: page([m("a")], "c1") },
      { type: "more", id: 2 },
      { type: "search", id: 3 },
      { type: "loaded", id: 2, result: page([m("late")], null) },
      { type: "loaded", id: 3, result: page([m("b")], null) },
    ]);
    expect(s.items.map((x) => x.id)).toEqual(["b"]);
  });
  it("load more appends and de-duplicates by id", () => {
    const s = run([
      { type: "search", id: 1 },
      { type: "loaded", id: 1, result: page([m("a"), m("b")], "c1") },
      { type: "more", id: 2 },
      { type: "loaded", id: 2, result: page([m("b"), m("c")], null) },
    ]);
    expect(s.items.map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(s.nextCursor).toBeNull();
    expect(s.moreId).toBeNull();
  });
  it("a failed load more keeps the rows and cursor", () => {
    const s = run([
      { type: "search", id: 1 },
      { type: "loaded", id: 1, result: page([m("a")], "c1") },
      { type: "more", id: 2 },
      { type: "loaded", id: 2, result: { ok: false, code: "unavailable" } },
    ]);
    expect(s).toMatchObject({ nextCursor: "c1", moreFailed: true, moreId: null, status: "ready" });
    expect(s.items).toHaveLength(1);
  });
  it("a failed search shows the error", () => {
    const s = run([
      { type: "search", id: 1 },
      { type: "loaded", id: 1, result: { ok: false, code: "internal" } },
    ]);
    expect(s).toMatchObject({ status: "error", errorCode: "internal" });
  });
});

describe("canLoadMore", () => {
  const ready = run([
    { type: "search", id: 1 },
    { type: "loaded", id: 1, result: page([m("a")], "c1") },
  ]);
  it("true only with a cursor, ready and no page in flight", () => {
    expect(canLoadMore(ready)).toBe(true);
    expect(canLoadMore({ ...ready, nextCursor: null })).toBe(false);
    expect(canLoadMore({ ...ready, status: "loading" })).toBe(false);
    expect(canLoadMore(pickerReducer(ready, { type: "more", id: 2 }))).toBe(false);
  });
});

describe("selectedMember", () => {
  const s = run([
    { type: "search", id: 1 },
    { type: "loaded", id: 1, result: page([m("a"), m("b")], null) },
  ]);
  it("null when the id is not listed; the current occupant cannot be selected", () => {
    expect(selectedMember({ ...s, selectedId: "zzz" }, null)).toBeNull();
    expect(selectedMember({ ...s, selectedId: null }, null)).toBeNull();
    expect(selectedMember({ ...s, selectedId: "a" }, "a")).toBeNull();
    expect(selectedMember({ ...s, selectedId: "b" }, "a")?.id).toBe("b");
  });
});

describe("blocksSearchEnter", () => {
  it("Enter yes; Enter while composing no; other keys no", () => {
    expect(blocksSearchEnter("Enter", false)).toBe(true);
    expect(blocksSearchEnter("Enter", true)).toBe(false);
    expect(blocksSearchEnter("a", false)).toBe(false);
    expect(blocksSearchEnter("Escape", false)).toBe(false);
  });
});
