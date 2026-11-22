import { describe, expect, it } from "vitest";
import type { RoomDto } from "./rooms/types";
import { goTarget, keepGoodRooms, roomCodeFromPath } from "./room-switcher";

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
