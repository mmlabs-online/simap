import { describe, expect, it } from "vitest";
import { firstRoom, shownRoom, type CheckinInputs, type FirstRoom } from "./checkin-room";

const input = (p: Partial<CheckinInputs>): CheckinInputs => ({
  activeCheckinRoom: null,
  recentCheckins: [],
  seatRoomCodes: [],
  ...p,
});
const room = (code: string): FirstRoom => ({ kind: "room", code });

describe("firstRoom", () => {
  it("active check-in room wins over recent and seats", () => {
    expect(
      firstRoom(
        input({
          activeCheckinRoom: "C",
          recentCheckins: [{ roomCode: "B", at: "2026-11-01T00:00:00Z" }],
          seatRoomCodes: ["A", "B"],
        }),
      ),
    ).toEqual(room("C"));
  });
  it("active check-in wins even when the seat list does not list that room (seat list may lag)", () => {
    expect(firstRoom(input({ activeCheckinRoom: "Z", seatRoomCodes: ["A"] }))).toEqual(room("Z"));
  });
  it("no active: most recent check-in whose room has a seat", () => {
    expect(
      firstRoom(
        input({
          recentCheckins: [
            { roomCode: "A", at: "2026-11-01T00:00:00Z" },
            { roomCode: "B", at: "2026-11-02T00:00:00Z" },
          ],
          seatRoomCodes: ["A", "B"],
        }),
      ),
    ).toEqual(room("B"));
  });
  it("recent check-in in a room without a seat is skipped; the next recent one with a seat wins", () => {
    expect(
      firstRoom(
        input({
          recentCheckins: [
            { roomCode: "X", at: "2026-11-03T00:00:00Z" },
            { roomCode: "B", at: "2026-11-02T00:00:00Z" },
            { roomCode: "A", at: "2026-11-01T00:00:00Z" },
          ],
          seatRoomCodes: ["A", "B"],
        }),
      ),
    ).toEqual(room("B"));
  });
  it("all recent check-ins are in seatless rooms → lowest seat room code", () => {
    expect(
      firstRoom(
        input({
          recentCheckins: [{ roomCode: "X", at: "2026-11-03T00:00:00Z" }],
          seatRoomCodes: ["C", "B"],
        }),
      ),
    ).toEqual(room("B"));
  });
  it("tie on at: lower room code wins; unparsable at is ignored", () => {
    expect(
      firstRoom(
        input({
          recentCheckins: [
            { roomCode: "B", at: "2026-11-02T00:00:00Z" },
            { roomCode: "A", at: "2026-11-02T00:00:00Z" },
            { roomCode: "C", at: "not a date" },
          ],
          seatRoomCodes: ["A", "B", "C"],
        }),
      ),
    ).toEqual(room("A"));
    expect(
      firstRoom(input({ recentCheckins: [{ roomCode: "C", at: "nope" }], seatRoomCodes: ["C"] })),
    ).toEqual(room("C"));
  });
  it("empty check-in inputs (SIM-057 reality) → lowest room code", () => {
    expect(firstRoom(input({ seatRoomCodes: ["B2", "A1"] }))).toEqual(room("A1"));
  });
  it('unsorted and duplicate seat room codes; "A10" before "A2" (localeCompare, same as composeSeats)', () => {
    expect(firstRoom(input({ seatRoomCodes: ["B", "A2", "A10", "A2"] }))).toEqual(room("A10"));
    expect(["A2", "A10"].sort((a, b) => a.localeCompare(b))[0]).toBe("A10");
  });
  it("no seats and no active check-in → noSeat", () => {
    expect(firstRoom(input({}))).toEqual({ kind: "noSeat" });
    expect(
      firstRoom(input({ recentCheckins: [{ roomCode: "A", at: "2026-11-01T00:00:00Z" }] })),
    ).toEqual({ kind: "noSeat" });
  });
});

describe("shownRoom", () => {
  it("a requested code in the room list wins", () => {
    expect(shownRoom({ requested: "B", roomCodes: ["A", "B"], first: room("A") })).toEqual(
      room("B"),
    );
  });
  it("requested code not in the list falls back to first room; no seat → noSeat", () => {
    expect(shownRoom({ requested: "Q", roomCodes: ["A"], first: room("A") })).toEqual(room("A"));
    expect(shownRoom({ requested: "Q", roomCodes: ["A"], first: { kind: "noSeat" } })).toEqual({
      kind: "noSeat",
    });
    expect(shownRoom({ requested: null, roomCodes: ["A"], first: { kind: "noSeat" } })).toEqual({
      kind: "noSeat",
    });
  });
  it("loading while the needed list (rooms for a request, first room otherwise) is not ready", () => {
    expect(shownRoom({ requested: "B", roomCodes: null, first: room("A") })).toEqual({
      kind: "loading",
    });
    expect(shownRoom({ requested: null, roomCodes: ["A"], first: null })).toEqual({
      kind: "loading",
    });
    expect(shownRoom({ requested: null, roomCodes: null, first: room("A") })).toEqual(room("A"));
  });
});
