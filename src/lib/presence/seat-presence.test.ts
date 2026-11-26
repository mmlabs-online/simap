import { describe, expect, it } from "vitest";
import type { SeatView } from "@/lib/sprites/layout";
import { seatPresenceMap } from "./seat-presence";
import type { RoomPresenceMember } from "./types";

const view = (p: Partial<SeatView> = {}): SeatView => ({
  state: "occupied",
  avatarSeed: null,
  name: null,
  look: null,
  ...p,
});
const member = (memberId: string, seatId: string): RoomPresenceMember => ({
  memberId,
  displayName: memberId,
  seatId,
  seatCode: seatId.toUpperCase(),
  checkedInAt: "2026-03-06T01:30:00Z",
  source: "self",
});

describe("seatPresenceMap", () => {
  it("occupant with a presence row of that member is present; without a row away; no occupant absent", () => {
    const views = {
      a: view({ avatarSeed: "m1" }),
      b: view({ avatarSeed: "m2" }),
      c: view({ state: "empty" }),
    };
    expect(seatPresenceMap(views, [member("m1", "a")])).toEqual({ a: "present", b: "away" });
  });

  it("a row for a seat that is not in the layout is ignored; a row on a seat of another occupant leaves it away", () => {
    const views = { a: view({ avatarSeed: "m1" }) };
    expect(seatPresenceMap(views, [member("m1", "zzz")])).toEqual({ a: "away" });
    expect(seatPresenceMap(views, [member("m9", "a")])).toEqual({ a: "away" });
  });

  it("pending and cannot seats with an occupant follow the same rule", () => {
    const views = {
      a: view({ state: "pending", avatarSeed: "m1" }),
      b: view({ state: "cannot", avatarSeed: "m2" }),
    };
    expect(seatPresenceMap(views, [member("m2", "b")])).toEqual({ a: "away", b: "present" });
  });
});
