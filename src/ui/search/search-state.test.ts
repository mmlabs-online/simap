import { describe, expect, it } from "vitest";
import type { DeviceHit, MemberHit, SeatHit } from "@/lib/search/types";
import {
  canLoadMore,
  INITIAL_SEARCH,
  isSearchable,
  normalizeSearchQuery,
  parseSearchParam,
  searchHref,
  searchReducer,
  seatResultHref,
  type AllGroups,
  type SearchEvent,
  type SearchState,
} from "./search-state";

const seat = (id: string, code = `C302-0${id}`): SeatHit => ({
  id,
  code,
  roomId: "r1",
  roomCode: "C302",
  occupant: null,
});
const device = (id: string): DeviceHit => ({
  id,
  name: `Dev ${id}`,
  inventoryNumber: `INV-${id}`,
  mac: null,
  owner: { id: "m1", displayName: "Nguyễn Văn An" },
  placement: null,
});
const member = (id: string): MemberHit => ({
  id,
  displayName: "Nguyễn Văn An",
  employeeCode: null,
  status: "active",
});
const all = (over: Partial<AllGroups> = {}): AllGroups => ({
  seats: { items: [seat("1")], nextCursor: "cs" },
  devices: { items: [device("1")], nextCursor: null },
  members: { items: [member("1")], nextCursor: "cm" },
  ...over,
});

const run = (events: SearchEvent[], from: SearchState = INITIAL_SEARCH) =>
  events.reduce(searchReducer, from);
const ready = () =>
  run([
    { type: "search", id: 1, q: "an" },
    { type: "loaded", id: 1, result: { ok: true, value: all() } },
  ]);

describe("normalizeSearchQuery", () => {
  it("normalizeSearchQuery: NFC, collapses whitespace, trims, caps at 80 code points", () => {
    const nfd = "Nguyễn";
    expect(normalizeSearchQuery(`  ${nfd}   Văn `)).toBe("Nguyễn Văn");
    expect(normalizeSearchQuery("a\n\tb")).toBe("a b");
    const long = "ễ".repeat(81);
    expect([...normalizeSearchQuery(long)]).toHaveLength(80);
    expect(normalizeSearchQuery(`${"a".repeat(79)} b`)).toBe("a".repeat(79));
  });
  it('isSearchable: "", "   ", "\\u0301" false; "nguyen", "Đ" true', () => {
    expect(isSearchable("")).toBe(false);
    expect(isSearchable(normalizeSearchQuery("   "))).toBe(false);
    expect(isSearchable("́")).toBe(false);
    expect(isSearchable("nguyen")).toBe(true);
    expect(isSearchable("Đ")).toBe(true);
  });
  it("parseSearchParam: none or duplicate -> empty; one value -> normalized", () => {
    expect(parseSearchParam([])).toBe("");
    expect(parseSearchParam(["a", "b"])).toBe("");
    expect(parseSearchParam(["  an  "])).toBe("an");
  });
});

describe("hrefs", () => {
  it('searchHref: "" -> /search; encoded otherwise', () => {
    expect(searchHref("")).toBe("/search");
    expect(searchHref("Nguyễn Văn")).toBe(`/search?q=${encodeURIComponent("Nguyễn Văn")}`);
    expect(searchHref("Nguyễn Văn")).not.toContain("ễ");
    expect(searchHref("a&b")).toBe("/search?q=a%26b");
  });
  it("seatResultHref: room with seat; dot room null; room encoded", () => {
    expect(seatResultHref({ roomCode: "C302", code: "C302-01" })).toBe("/rooms/C302?seat=C302-01");
    expect(seatResultHref({ roomCode: "..", code: "..-01" })).toBeNull();
    expect(seatResultHref({ roomCode: "A 1", code: "A 1-01" })).toBe("/rooms/A%201?seat=A%201-01");
  });
});

describe("searchReducer", () => {
  it('search "" -> idle, groups empty, no loading', () => {
    const s = run([{ type: "search", id: 1, q: "" }]);
    expect(s.status).toBe("idle");
    expect(s.seats.items).toEqual([]);
    expect(s.latest).toBe(1);
  });
  it("search then loaded: ready with all three groups", () => {
    const s = ready();
    expect(s.status).toBe("ready");
    expect(s.query).toBe("an");
    expect(s.seats.items).toHaveLength(1);
    expect(s.devices.items).toHaveLength(1);
    expect(s.members.nextCursor).toBe("cm");
  });
  it("stale loaded (older id) is dropped", () => {
    const s = run([
      { type: "search", id: 1, q: "a" },
      { type: "search", id: 2, q: "ab" },
      { type: "loaded", id: 1, result: { ok: true, value: all() } },
    ]);
    expect(s.status).toBe("loading");
    expect(s.query).toBe("ab");
  });
  it("loaded failure -> error with code; a later search clears it", () => {
    const s = run([
      { type: "search", id: 1, q: "a" },
      { type: "loaded", id: 1, result: { ok: false, code: "unavailable" } },
    ]);
    expect(s.status).toBe("error");
    expect(s.errorCode).toBe("unavailable");
    const next = run([{ type: "search", id: 2, q: "a" }], s);
    expect(next.status).toBe("loading");
    expect(next.errorCode).toBeNull();
  });
  it("more + moreLoaded appends to that group only, dedups by id, takes the new cursor", () => {
    const s = run(
      [
        { type: "more", group: "seats", id: 2 },
        {
          type: "moreLoaded",
          group: "seats",
          id: 2,
          result: { ok: true, value: { items: [seat("1"), seat("2")], nextCursor: null } },
        },
      ],
      ready(),
    );
    expect(s.seats.items.map((i) => i.id)).toEqual(["1", "2"]);
    expect(s.seats.nextCursor).toBeNull();
    expect(s.seats.moreId).toBeNull();
    expect(s.members).toEqual(ready().members);
  });
  it("moreLoaded failure keeps items and sets that group's error; a new more clears it", () => {
    const failed = run(
      [
        { type: "more", group: "members", id: 2 },
        { type: "moreLoaded", group: "members", id: 2, result: { ok: false, code: "unavailable" } },
      ],
      ready(),
    );
    expect(failed.members.items).toHaveLength(1);
    expect(failed.members.moreError).toBe("unavailable");
    expect(failed.seats.moreError).toBeNull();
    const again = run([{ type: "more", group: "members", id: 3 }], failed);
    expect(again.members.moreError).toBeNull();
  });
  it("moreLoaded after a new search is dropped", () => {
    const s = run(
      [
        { type: "more", group: "seats", id: 2 },
        { type: "search", id: 3, q: "bo" },
        {
          type: "moreLoaded",
          group: "seats",
          id: 2,
          result: { ok: true, value: { items: [seat("9")], nextCursor: null } },
        },
      ],
      ready(),
    );
    expect(s.seats.items).toEqual([]);
    expect(s.status).toBe("loading");
  });
  it("two groups page at once; each answer lands in its own group", () => {
    const s = run(
      [
        { type: "more", group: "seats", id: 2 },
        { type: "more", group: "members", id: 3 },
        {
          type: "moreLoaded",
          group: "members",
          id: 3,
          result: { ok: true, value: { items: [member("2")], nextCursor: null } },
        },
        {
          type: "moreLoaded",
          group: "seats",
          id: 2,
          result: { ok: true, value: { items: [seat("2")], nextCursor: null } },
        },
      ],
      ready(),
    );
    expect(s.seats.items.map((i) => i.id)).toEqual(["1", "2"]);
    expect(s.members.items.map((i) => i.id)).toEqual(["1", "2"]);
  });
});

describe("canLoadMore", () => {
  it("canLoadMore: false when not ready, without nextCursor, or while its more is in flight", () => {
    expect(canLoadMore(INITIAL_SEARCH, "seats")).toBe(false);
    expect(canLoadMore(ready(), "seats")).toBe(true);
    expect(canLoadMore(ready(), "devices")).toBe(false);
    expect(canLoadMore(run([{ type: "more", group: "seats", id: 2 }], ready()), "seats")).toBe(
      false,
    );
  });
});
