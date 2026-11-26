import { describe, expect, it } from "vitest";
import type { RoomDto } from "./rooms/types";
import {
  checkinGoTarget,
  checkinRoomHref,
  goTarget,
  keepGoodRooms,
  roomCodeFromPath,
  roomCodeFromQuery,
  visibleSelection,
} from "./room-switcher";

const room = (code: string): RoomDto => ({
  id: code,
  code,
  name: code,
  description: null,
  floor: null,
  seatCount: 0,
  occupiedCount: 0,
});

describe("roomCodeFromPath", () => {
  it("reads the code from detail and edit paths", () => {
    expect(roomCodeFromPath("/rooms/C302")).toBe("C302");
    expect(roomCodeFromPath("/rooms/C302/edit")).toBe("C302");
  });
  it("returns null elsewhere", () => {
    for (const p of ["/rooms", "/", "/rooms/", "/rooms/C302/x"]) {
      expect(roomCodeFromPath(p)).toBeNull();
    }
  });
  it("does not decode", () => {
    expect(roomCodeFromPath("/rooms/A%201")).toBe("A%201");
    expect(roomCodeFromPath("/rooms/%")).toBe("%");
    expect(roomCodeFromPath("/rooms/Ph%C3%B2ng1")).toBe("Ph%C3%B2ng1");
  });
});

describe("goTarget", () => {
  it("is null for empty, current and dot targets", () => {
    expect(goTarget("", null)).toBeNull();
    expect(goTarget("C302", "C302")).toBeNull();
    expect(goTarget(".", null)).toBeNull();
    expect(goTarget("..", "C1")).toBeNull();
  });
  it("returns the encoded href otherwise", () => {
    expect(goTarget("C302", null)).toBe("/rooms/C302");
    expect(goTarget("A 1", null)).toBe("/rooms/A%201");
    expect(goTarget("B1", "C302")).toBe("/rooms/B1");
  });
});

describe("keepGoodRooms", () => {
  const prev = [room("A")];
  it("takes a ready list, even an empty one", () => {
    expect(keepGoodRooms(prev, "ready", [room("B")])).toEqual([room("B")]);
    expect(keepGoodRooms(prev, "ready", [])).toEqual([]);
  });
  it("keeps the previous list on loading or error", () => {
    expect(keepGoodRooms(prev, "error", [])).toBe(prev);
    expect(keepGoodRooms(prev, "loading", [])).toBe(prev);
  });
});

describe("visibleSelection", () => {
  it("returns a listed code", () => {
    expect(visibleSelection([room("A"), room("B")], "B")).toBe("B");
  });
  it("returns empty for an unlisted code or an empty list", () => {
    expect(visibleSelection([room("A")], "B")).toBe("");
    expect(visibleSelection([], "B")).toBe("");
  });
  it("leaves Go with no target when the code is not listed", () => {
    expect(goTarget(visibleSelection([], "B"), null)).toBeNull();
  });
});

describe("roomCodeFromQuery", () => {
  it("none, empty, multiple, invalid chars, too long → null; valid code", () => {
    expect(roomCodeFromQuery([])).toBeNull();
    expect(roomCodeFromQuery([""])).toBeNull();
    expect(roomCodeFromQuery(["A1", "B2"])).toBeNull();
    expect(roomCodeFromQuery(["a 1"])).toBeNull();
    expect(roomCodeFromQuery(["A".repeat(33)])).toBeNull();
    expect(roomCodeFromQuery(["C302"])).toBe("C302");
    expect(roomCodeFromQuery(["A.1_b-2".toUpperCase()])).toBe("A.1_B-2");
  });
});

describe("checkinRoomHref", () => {
  it("bare path, room only, room + seat, seat only, encodes values", () => {
    expect(checkinRoomHref("/", null, null)).toBe("/");
    expect(checkinRoomHref("/checkin", "A1", null)).toBe("/checkin?room=A1");
    expect(checkinRoomHref("/checkin", "A1", "A1-01")).toBe("/checkin?room=A1&seat=A1-01");
    expect(checkinRoomHref("/", null, "A1-01")).toBe("/?seat=A1-01");
    expect(checkinRoomHref("/", "A&B", null)).toBe("/?room=A%26B");
  });
});

describe("checkinGoTarget", () => {
  it("empty or current selection → null; other code → href with ?room=", () => {
    expect(checkinGoTarget("/", "", "A1")).toBeNull();
    expect(checkinGoTarget("/", "A1", "A1")).toBeNull();
    expect(checkinGoTarget("/checkin", "B2", "A1")).toBe("/checkin?room=B2");
    expect(checkinGoTarget("/", "B2", null)).toBe("/?room=B2");
  });
});
