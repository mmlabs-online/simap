import { describe, expect, it } from "vitest";
import type { SeatView } from "@/lib/sprites/layout";
import { derivedChoice } from "@/lib/sprites/pixel-look";
import { checkinTime, whosHereRows } from "./whos-here";
import type { RoomPresenceMember } from "./types";

const member = (p: Partial<RoomPresenceMember> = {}): RoomPresenceMember => ({
  memberId: "m1",
  displayName: "Lee",
  seatId: "s1",
  seatCode: "A1",
  checkedInAt: "2026-03-06T01:30:00Z",
  source: "self",
  ...p,
});
const none = new Set<string>();

describe("whosHereRows", () => {
  it("keeps every member the API returns, in API order, including members whose seat is not on the map", () => {
    const rows = whosHereRows({
      members: [member({ memberId: "m2", seatCode: "Z9" }), member({ memberId: "m1" })],
      seatViews: {},
      placedCodes: new Set(["A1"]),
    });
    expect(rows.map((r) => [r.memberId, r.focusable])).toEqual([
      ["m2", false],
      ["m1", true],
    ]);
  });

  it("look comes from the seat view when its occupant is the member, else derived from the member id", () => {
    const look = { skin: 1, hair: 2, style: 3 as const, shirt: 4 };
    const seatViews: Record<string, SeatView> = {
      s1: { state: "occupied", avatarSeed: "m1", name: "Lee", look },
      s2: { state: "occupied", avatarSeed: "other", name: "X", look },
    };
    const rows = whosHereRows({
      members: [member(), member({ memberId: "m2", seatId: "s2" }), member({ memberId: "m3" })],
      seatViews,
      placedCodes: none,
    });
    expect(rows[0].look).toEqual(look);
    expect(rows[1].look).toEqual(derivedChoice("m2"));
    expect(rows[2].look).toEqual(derivedChoice("m3"));
  });

  it("source is passed through, an empty display name is flagged, Vietnamese names stay verbatim", () => {
    const rows = whosHereRows({
      members: [
        member({ displayName: "Nguyễn Thị Ánh", source: "provider" }),
        member({ memberId: "m2", displayName: "  " }),
      ],
      seatViews: {},
      placedCodes: none,
    });
    expect(rows[0]).toMatchObject({ name: "Nguyễn Thị Ánh", source: "provider", unnamed: false });
    expect(rows[1].unnamed).toBe(true);
  });
});

describe("checkinTime", () => {
  it("shows HH:mm in UTC+7", () => {
    expect(checkinTime("2026-03-06T01:30:00Z")).toBe("08:30");
    expect(checkinTime("2026-03-06T17:05:00Z")).toBe("00:05");
  });

  it("returns an invalid input unchanged", () => {
    expect(checkinTime("not a time")).toBe("not a time");
  });
});
