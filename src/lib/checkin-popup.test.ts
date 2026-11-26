import { describe, expect, it } from "vitest";
import { firstRoom } from "./checkin-room";
import {
  autoOpen,
  buttonAction,
  checkInOutcome,
  firstRoomInputs,
  initialSelection,
  popupReducer,
  popupRooms,
} from "./checkin-popup";
import type { MyPresenceDto } from "./presence/types";

const active = (source: "self" | "provider" = "self"): MyPresenceDto => ({
  roomId: "r1",
  roomCode: "A1",
  seatId: "s1",
  seatCode: "A1-01",
  checkedInAt: "2026-03-06T01:00:00Z",
  source,
});
const base = {
  seats: "ready",
  seatCount: 1,
  presence: "ready",
  active: null,
  seatPanelOpen: false,
} as const;

describe("autoOpen", () => {
  it("false while my seats or my presence is loading (no flash for checked-in members)", () => {
    expect(autoOpen({ ...base, seats: "loading" })).toBe(false);
    expect(autoOpen({ ...base, presence: "loading" })).toBe(false);
  });
  it("false when presence is set, for source self and provider (checked in from any source)", () => {
    expect(autoOpen({ ...base, active: active("self") })).toBe(false);
    expect(autoOpen({ ...base, active: active("provider") })).toBe(false);
  });
  it("false on a presence or seats error; false with zero seats; false while the seat panel is open", () => {
    expect(autoOpen({ ...base, presence: "error" })).toBe(false);
    expect(autoOpen({ ...base, seats: "error" })).toBe(false);
    expect(autoOpen({ ...base, seatCount: 0 })).toBe(false);
    expect(autoOpen({ ...base, seatPanelOpen: true })).toBe(false);
  });
  it("true with >=1 seat, presence loaded and null, no seat panel", () => {
    expect(autoOpen(base)).toBe(true);
  });
});

describe("popupReducer", () => {
  it("pending + auto -> open; pending + skip -> closed; open + justLook -> closed; open + checkedIn -> closed", () => {
    expect(popupReducer("pending", "auto")).toBe("open");
    expect(popupReducer("pending", "skip")).toBe("closed");
    expect(popupReducer("open", "justLook")).toBe("closed");
    expect(popupReducer("open", "checkedIn")).toBe("closed");
  });
  it("closed + auto stays closed (once per page load); closed + openFromButton -> open; open + auto is a no-op", () => {
    expect(popupReducer("closed", "auto")).toBe("closed");
    expect(popupReducer("closed", "skip")).toBe("closed");
    expect(popupReducer("closed", "openFromButton")).toBe("open");
    expect(popupReducer("open", "auto")).toBe("open");
    expect(popupReducer("open", "skip")).toBe("open");
  });
});

const rooms = [
  { id: "r1", code: "A1", name: "Lab" },
  { id: "r2", code: "B2", name: "Phòng Họp Đà Nẵng" },
  { id: "r3", code: "C3", name: "Annex" },
  { id: "r4", code: "D4", name: "Depot" },
];
const seat = (roomId: string, roomCode: string, code: string, seq: number) => ({
  roomId,
  roomCode,
  code,
  seq,
});

describe("popupRooms", () => {
  it("seat rooms by most recent check-in desc, then never-visited by room code; first row equals firstRoom() for the same inputs", () => {
    const seats = [
      seat("r1", "A1", "A1-01", 1),
      seat("r2", "B2", "B2-01", 1),
      seat("r3", "C3", "C3-01", 1),
    ];
    const recent = [
      { roomId: "r2", roomCode: "B2", lastCheckedInAt: "2026-03-05T01:00:00Z" },
      { roomId: "r3", roomCode: "C3", lastCheckedInAt: "2026-03-06T01:00:00Z" },
      { roomId: "r1", roomCode: "A1", lastCheckedInAt: "garbage" },
    ];
    const { seatRooms } = popupRooms({ rooms, seats, recent, counts: {} });
    expect(seatRooms.map((r) => r.code)).toEqual(["C3", "B2", "A1"]);
    const first = firstRoom({
      activeCheckinRoom: null,
      recentCheckins: recent.map((r) => ({ roomCode: r.roomCode, at: r.lastCheckedInAt })),
      seatRoomCodes: seats.map((s) => s.roomCode),
    });
    expect(first).toEqual({ kind: "room", code: seatRooms[0].code });
    const never = popupRooms({ rooms, seats, recent: [], counts: {} }).seatRooms;
    expect(never.map((r) => r.code)).toEqual(["A1", "B2", "C3"]);
  });
  it("several seats in one room -> lowest seq seat code (D77), one row per room", () => {
    const seats = [
      seat("r1", "A1", "A1-09", 9),
      seat("r1", "A1", "A1-02", 2),
      seat("r1", "A1", "A1-05", 5),
    ];
    const { seatRooms } = popupRooms({ rooms, seats, recent: [], counts: {} });
    expect(seatRooms).toHaveLength(1);
    expect(seatRooms[0].seatCode).toBe("A1-02");
  });
  it("count from the map, missing/failed -> null; lastCheckedInAt from recent or null (never)", () => {
    const seats = [seat("r1", "A1", "A1-01", 1), seat("r2", "B2", "B2-01", 1)];
    const { seatRooms } = popupRooms({
      rooms,
      seats,
      recent: [{ roomId: "r1", lastCheckedInAt: "2026-03-06T08:30:00Z" }],
      counts: { r1: 3, r2: null },
    });
    expect(seatRooms[0]).toMatchObject({
      code: "A1",
      count: 3,
      lastCheckedInAt: "2026-03-06T08:30:00Z",
    });
    expect(seatRooms[1]).toMatchObject({ code: "B2", count: null, lastCheckedInAt: null });
    expect(popupRooms({ rooms, seats, recent: [], counts: {} }).seatRooms[0].count).toBeNull();
  });
  it("locked = listed rooms without a seat, sorted by code, never contain a seat room; recent entries of locked rooms are ignored", () => {
    const seats = [seat("r2", "B2", "B2-01", 1)];
    const { seatRooms, locked } = popupRooms({
      rooms: [...rooms].reverse(),
      seats,
      recent: [{ roomId: "r4", lastCheckedInAt: "2026-03-06T08:30:00Z" }],
      counts: {},
    });
    expect(locked.map((r) => r.code)).toEqual(["A1", "C3", "D4"]);
    expect(seatRooms.map((r) => r.code)).toEqual(["B2"]);
  });
  it("rooms list not loaded -> seat rooms still listed (name falls back to empty), locked empty; Vietnamese names kept verbatim", () => {
    const seats = [seat("r2", "B2", "B2-01", 1)];
    const none = popupRooms({ rooms: [], seats, recent: [], counts: {} });
    expect(none.seatRooms[0].name).toBe("");
    expect(none.locked).toEqual([]);
    expect(popupRooms({ rooms, seats, recent: [], counts: {} }).seatRooms[0].name).toBe(
      "Phòng Họp Đà Nẵng",
    );
  });
});

describe("initialSelection", () => {
  const rows = [{ code: "C3" }, { code: "A1" }];
  it("shown room when it is a seat room; else first seat row; no rows -> null", () => {
    expect(initialSelection(rows, "A1")).toBe("A1");
    expect(initialSelection(rows, "Z9")).toBe("C3");
    expect(initialSelection(rows, null)).toBe("C3");
    expect(initialSelection([], "A1")).toBeNull();
  });
});

describe("buttonAction", () => {
  const seatRooms = [{ roomId: "r1", code: "A1" }];
  const input = {
    presence: "ready",
    seatCount: 1,
    active: null,
    seatRooms,
    shownCode: "A1",
  } as const;
  it("presence loading -> hidden; presence error -> retry; zero seats -> hidden", () => {
    expect(buttonAction({ ...input, presence: "loading" })).toEqual({ kind: "hidden" });
    expect(buttonAction({ ...input, presence: "error" })).toEqual({ kind: "retry" });
    expect(buttonAction({ ...input, seatCount: 0, seatRooms: [] })).toEqual({ kind: "hidden" });
  });
  it("presence set -> checkout (also when the shown room is another room)", () => {
    expect(buttonAction({ ...input, active: active() })).toEqual({ kind: "checkout" });
    expect(buttonAction({ ...input, active: active(), shownCode: "B2" })).toEqual({
      kind: "checkout",
    });
  });
  it("presence null + shown is a seat room -> checkin {roomId}; shown not a seat room -> openPopup", () => {
    expect(buttonAction(input)).toEqual({ kind: "checkin", roomId: "r1" });
    expect(buttonAction({ ...input, shownCode: "B2" })).toEqual({ kind: "openPopup" });
    expect(buttonAction({ ...input, shownCode: null })).toEqual({ kind: "openPopup" });
  });
});

describe("checkInOutcome", () => {
  it("ok -> close; 409 already_checked_in -> close + refreshPresence; 422 no_seat_in_room -> stay + reloadSeats + error code; other -> stay + error code", () => {
    expect(checkInOutcome({ ok: true })).toEqual({
      close: true,
      refreshPresence: false,
      reloadSeats: false,
      errorCode: null,
    });
    expect(checkInOutcome({ ok: false, code: "already_checked_in" })).toEqual({
      close: true,
      refreshPresence: true,
      reloadSeats: false,
      errorCode: null,
    });
    expect(checkInOutcome({ ok: false, code: "no_seat_in_room" })).toEqual({
      close: false,
      refreshPresence: false,
      reloadSeats: true,
      errorCode: "no_seat_in_room",
    });
    expect(checkInOutcome({ ok: false, code: "unavailable" })).toEqual({
      close: false,
      refreshPresence: false,
      reloadSeats: false,
      errorCode: "unavailable",
    });
  });
});

describe("firstRoomInputs", () => {
  it("null data -> no active room and no recent; maps presence.roomCode and recent -> {roomCode, at}", () => {
    expect(firstRoomInputs(null)).toEqual({ activeCheckinRoom: null, recentCheckins: [] });
    expect(
      firstRoomInputs({
        workDate: "2026-03-06",
        presence: active(),
        recent: [{ roomId: "r2", roomCode: "B2", lastCheckedInAt: "2026-03-05T01:00:00Z" }],
      }),
    ).toEqual({
      activeCheckinRoom: "A1",
      recentCheckins: [{ roomCode: "B2", at: "2026-03-05T01:00:00Z" }],
    });
  });
});
