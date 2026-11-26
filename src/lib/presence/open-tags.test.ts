import { describe, expect, it } from "vitest";
import type { RoomLayout, SeatView } from "@/lib/sprites/layout";
import { myMemberId, openTagSeats } from "./open-tags";
import type { MyPresenceDto } from "./types";

const seat = (id: string, x: number, y: number) => ({
  id,
  code: id.toUpperCase(),
  sprite: "desk.single",
  x,
  y,
  rotation: 0 as const,
});
const layout: RoomLayout = {
  w: 12,
  h: 8,
  floors: [],
  fixtures: [],
  seats: [seat("c", 6, 4), seat("a", 2, 1), seat("b", 6, 1), seat("d", 2, 4)],
};
const view = (state: SeatView["state"], avatarSeed: string | null): SeatView => ({
  state,
  avatarSeed,
  name: null,
  look: null,
});
const views = {
  a: view("mine", "me"),
  b: view("occupied", "other"),
  c: view("mine", "me"),
  d: view("mine", "me"),
};
const my = (roomId: string, seatId: string): MyPresenceDto => ({
  roomId,
  roomCode: "R",
  seatId,
  seatCode: seatId.toUpperCase(),
  checkedInAt: "2026-03-06T01:30:00Z",
  source: "self",
});

describe("openTagSeats", () => {
  it("not checked in, or checked in to another room: none", () => {
    expect(openTagSeats({ layout, seatViews: views, my: null, roomId: "r1" })).toEqual([]);
    expect(openTagSeats({ layout, seatViews: views, my: my("r2", "a"), roomId: "r1" })).toEqual([]);
  });

  it("checked in here: my other seats in reading order, the active seat left out", () => {
    expect(openTagSeats({ layout, seatViews: views, my: my("r1", "a"), roomId: "r1" })).toEqual([
      "d",
      "c",
    ]);
  });
});

describe("myMemberId", () => {
  it("from the occupant of my active seat; else of a mine seat; else null", () => {
    expect(myMemberId(views, my("r1", "a"))).toBe("me");
    expect(myMemberId({ b: views.b, c: views.c }, my("r1", "zzz"))).toBe("me");
    expect(myMemberId({ b: views.b }, my("r1", "zzz"))).toBeNull();
    expect(myMemberId({ c: views.c }, null)).toBe("me");
  });
});
