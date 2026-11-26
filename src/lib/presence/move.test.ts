import { describe, expect, it } from "vitest";
import { moveOutcome } from "./move";
import type { MyPresenceDto } from "./types";

const presence: MyPresenceDto = {
  roomId: "r",
  roomCode: "R",
  seatId: "s",
  seatCode: "S",
  checkedInAt: "2026-03-06T01:30:00Z",
  source: "self",
};

describe("moveOutcome", () => {
  it("ok applies the returned presence and shows no error", () => {
    expect(moveOutcome({ ok: true, value: presence })).toEqual({
      apply: { presence },
      refreshMine: false,
      reloadLayout: false,
      errorCode: null,
    });
  });

  it("409 not_checked_in refreshes my presence and shows the code", () => {
    const out = moveOutcome({ ok: false, code: "not_checked_in" });
    expect(out).toMatchObject({ apply: null, refreshMine: true, errorCode: "not_checked_in" });
  });

  it("422 seat_not_yours reloads the layout and shows the code", () => {
    const out = moveOutcome({ ok: false, code: "seat_not_yours" });
    expect(out).toMatchObject({ apply: null, reloadLayout: true, errorCode: "seat_not_yours" });
  });

  it("unavailable and internal show the code only; nothing asks for a retry", () => {
    for (const code of ["unavailable", "internal"]) {
      const out = moveOutcome({ ok: false, code });
      expect(out).toEqual({
        apply: null,
        refreshMine: false,
        reloadLayout: false,
        errorCode: code,
      });
      expect(Object.keys(out)).not.toContain("retry");
    }
  });
});
