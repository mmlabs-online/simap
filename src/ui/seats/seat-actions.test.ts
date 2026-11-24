import { describe, expect, it } from "vitest";
import { apiCopy, apiErrorMessage } from "../copy/api";
import { seatsCopy } from "../copy/seats";
import type { SeatDto } from "@/lib/seats/types";
import {
  actionOutcome,
  canManageSeats,
  canRelease,
  confirmText,
  decideReask,
  deleteBlock,
  focusAfterDelete,
  keepRowsOnError,
  parseAddCount,
  parseCannotSeatReason,
  removeDialog,
  pickStep,
  reaskDialog,
  refusedDialog,
  requestResult,
  routeNotice,
  seatButtons,
  shouldReplaceAfterDelete,
  type AssignDialog,
} from "./seat-actions";

describe("shouldReplaceAfterDelete", () => {
  it("replaces only when mounted and the URL still shows the deleted seat", () => {
    expect(shouldReplaceAfterDelete(true, "C302-01", "C302-01")).toBe(true);
    expect(shouldReplaceAfterDelete(true, "C302-02", "C302-01")).toBe(false);
    expect(shouldReplaceAfterDelete(true, null, "C302-01")).toBe(false);
    expect(shouldReplaceAfterDelete(false, "C302-01", "C302-01")).toBe(false);
  });
});

describe("routeNotice", () => {
  it("shows nothing without a notice", () => {
    expect(routeNotice(null, "C302-01")).toEqual({ panel: null, page: null });
  });
  it("shows a notice for the open seat in the panel, unprefixed", () => {
    expect(routeNotice({ seatCode: "C302-01", text: "x" }, "C302-01")).toEqual({
      panel: "x",
      page: null,
    });
  });
  it("names the seat when the open seat is another one", () => {
    expect(routeNotice({ seatCode: "C302-01", text: "x" }, "C302-02")).toEqual({
      panel: seatsCopy.actions.noticeForSeat("C302-01", "x"),
      page: null,
    });
  });
  it("shows on the page with the seat code when no panel is open", () => {
    expect(routeNotice({ seatCode: "C302-01", text: "x" }, null)).toEqual({
      panel: null,
      page: seatsCopy.actions.noticeForSeat("C302-01", "x"),
    });
  });
  it("keeps an Add notice bare on the page and labels it in an open panel", () => {
    expect(routeNotice({ seatCode: null, text: "x" }, null)).toEqual({ panel: null, page: "x" });
    expect(routeNotice({ seatCode: null, text: "x" }, "C302-01")).toEqual({
      panel: seatsCopy.actions.noticeForAdd("x"),
      page: null,
    });
  });
});

const AUTH = ["unauthenticated", "forbidden", "member_deactivated", "org_required"];
const fail = (code: string) => ({ ok: false as const, code });

describe("role gating", () => {
  it("canManageSeats is admin only", () => {
    expect(canManageSeats("admin")).toBe(true);
    expect(canManageSeats("manager")).toBe(false);
    expect(canManageSeats("user")).toBe(false);
    expect(canManageSeats(null)).toBe(false);
    expect(canManageSeats(undefined)).toBe(false);
  });
  it("canRelease follows seat.mine", () => {
    expect(canRelease({ mine: true })).toBe(true);
    expect(canRelease({ mine: false })).toBe(false);
  });
});

describe("parseAddCount", () => {
  it("accepts 1 to 50 with spaces and leading zeros", () => {
    for (const [raw, count] of [
      ["1", 1],
      ["50", 50],
      [" 5 ", 5],
      ["05", 5],
    ] as const) {
      expect(parseAddCount(raw)).toEqual({ ok: true, count });
    }
  });
  it("rejects everything else", () => {
    for (const raw of ["", "0", "51", "-1", "1.5", "1e1", "0x5", "٥", "５", "9".repeat(400)]) {
      expect(parseAddCount(raw)).toEqual({ ok: false });
    }
  });
});

describe("deleteBlock", () => {
  const base = { occupant: null, deviceCount: 0, devices: [] };
  const occupant = { id: "m", displayName: "Ân" };
  it("empty seat is not blocked", () => {
    expect(deleteBlock(base)).toBeNull();
  });
  it("occupant, devices (by deviceCount) and both", () => {
    expect(deleteBlock({ ...base, occupant })).toBe(seatsCopy.actions.deleteBlockedOccupant);
    expect(deleteBlock({ ...base, deviceCount: 25 })).toBe(seatsCopy.actions.deleteBlockedDevices);
    expect(deleteBlock({ ...base, occupant, deviceCount: 1 })).toBe(
      seatsCopy.actions.deleteBlockedBoth,
    );
  });
});

describe("actionOutcome", () => {
  it("auth codes and invalid_request never reload", () => {
    for (const action of ["add", "delete", "release"] as const) {
      for (const code of [...AUTH, "invalid_request"]) {
        expect(actionOutcome(action, fail(code))).toEqual({
          reload: false,
          closePanel: false,
          message: apiCopy.errors[code as keyof typeof apiCopy.errors],
        });
      }
    }
  });
  it("add", () => {
    expect(actionOutcome("add", { ok: true })).toEqual({
      reload: true,
      closePanel: false,
      message: null,
    });
    expect(actionOutcome("add", fail("not_found")).reload).toBe(true);
    for (const code of ["unavailable", "internal"]) {
      expect(actionOutcome("add", fail(code))).toEqual({
        reload: true,
        closePanel: false,
        message: seatsCopy.actions.addCheckFirst,
      });
    }
  });
  it("delete", () => {
    expect(actionOutcome("delete", { ok: true })).toEqual({
      reload: true,
      closePanel: true,
      message: null,
    });
    expect(actionOutcome("delete", fail("not_found"))).toEqual({
      reload: true,
      closePanel: true,
      message: seatsCopy.actions.deleteGone,
    });
    expect(actionOutcome("delete", fail("seat_not_empty"))).toEqual({
      reload: true,
      closePanel: false,
      message: seatsCopy.actions.deleteChanged,
    });
    expect(actionOutcome("delete", fail("unavailable"))).toMatchObject({
      reload: true,
      closePanel: false,
    });
  });
  it("release", () => {
    expect(actionOutcome("release", { ok: true })).toEqual({
      reload: true,
      closePanel: false,
      message: null,
    });
    expect(actionOutcome("release", fail("not_allowed")).message).toBe(
      seatsCopy.actions.releaseChanged,
    );
    expect(actionOutcome("release", fail("not_found")).reload).toBe(true);
    expect(actionOutcome("release", fail("unavailable")).reload).toBe(true);
  });
  it("an unknown domain code reloads and shows the API message", () => {
    expect(actionOutcome("release", fail("occupant_changed"))).toEqual({
      reload: true,
      closePanel: false,
      message: apiCopy.errors.occupant_changed,
    });
  });
});

describe("keepRowsOnError", () => {
  it("only transient failures keep rows", () => {
    expect(keepRowsOnError("unavailable")).toBe(true);
    expect(keepRowsOnError("internal")).toBe(true);
    for (const code of ["not_found", ...AUTH]) expect(keepRowsOnError(code)).toBe(false);
  });
});

describe("focusAfterDelete", () => {
  const before = ["R-01", "R-02", "R-03"];
  it("next row, else previous, else null", () => {
    expect(focusAfterDelete(before, "R-02", ["R-01", "R-03"])).toBe("R-03");
    expect(focusAfterDelete(before, "R-03", ["R-01", "R-02"])).toBe("R-02");
    expect(focusAfterDelete(["R-01"], "R-01", [])).toBeNull();
  });
  it("never the deleted code, even if a failed reload kept it", () => {
    expect(focusAfterDelete(before, "R-03", before)).toBe("R-02");
    expect(focusAfterDelete(["R-01"], "R-01", ["R-01"])).toBeNull();
  });
});

const seatOf = (over: Partial<SeatDto> = {}): SeatDto => ({
  id: "s1",
  code: "C302-01",
  seq: 1,
  roomId: "r1",
  roomCode: "C302",
  status: "empty",
  cannotSeat: false,
  cannotSeatReason: null,
  occupant: null,
  mine: false,
  group: null,
  project: null,
  deviceCount: 0,
  devices: [],
  ...over,
});
const occupied = (id = "o1", displayName = "Trần Thị Bích") =>
  seatOf({ status: "occupied", occupant: { id, displayName } });
const chosen = { id: "m1", displayName: "Nguyễn Văn Ân" };

describe("seatButtons", () => {
  it("matrix over tier and seat state", () => {
    for (const tier of [null, undefined, "user"] as const) {
      expect(seatButtons(tier, seatOf()).assign).toBeNull();
    }
    for (const tier of ["manager", "admin"] as const) {
      expect(seatButtons(tier, seatOf()).assign).toBe("assign");
      expect(seatButtons(tier, occupied()).assign).toBe("replace");
      expect(seatButtons(tier, seatOf({ cannotSeat: true })).assignDisabled).toBe(true);
      expect(seatButtons(tier, occupied()).assignDisabled).toBe(false);
    }
    expect(seatButtons("manager", seatOf()).deleteSeat).toBe(false);
    expect(seatButtons("admin", seatOf()).deleteSeat).toBe(true);
    expect(seatButtons("user", seatOf({ mine: true })).release).toBe(true);
  });
});

describe("seatButtons tags", () => {
  it("manager and admin only", () => {
    for (const tier of [null, undefined, "user"] as const) {
      expect(seatButtons(tier, seatOf()).tags).toBe(false);
    }
    for (const tier of ["manager", "admin"] as const) {
      expect(seatButtons(tier, seatOf()).tags).toBe(true);
    }
  });
});

describe("actionOutcome setTags", () => {
  it("invalid_group and invalid_project reload with the message", () => {
    for (const code of ["invalid_group", "invalid_project"]) {
      expect(actionOutcome("setTags", fail(code))).toEqual({
        reload: true,
        closePanel: false,
        message: apiErrorMessage(code),
      });
    }
  });
});

describe("pickStep", () => {
  it("empty seat sends expected null", () => {
    expect(pickStep(seatOf(), chosen)).toEqual({
      kind: "send",
      memberId: "m1",
      memberName: "Nguyễn Văn Ân",
      expectedOccupantId: null,
    });
  });
  it("occupied builds one snapshot with the shown id and name", () => {
    expect(pickStep(occupied(), chosen)).toEqual({
      kind: "confirm",
      confirm: {
        expectedOccupantId: "o1",
        occupantName: "Trần Thị Bích",
        memberId: "m1",
        memberName: "Nguyễn Văn Ân",
      },
    });
  });
  it("the same person does nothing", () => {
    expect(pickStep(occupied("m1"), chosen)).toEqual({ kind: "none" });
  });
});

describe("confirmText", () => {
  it("exact replace text with diacritics", () => {
    expect(
      confirmText({
        expectedOccupantId: "o1",
        occupantName: "Trần Thị Bích",
        memberId: "m1",
        memberName: "Nguyễn Văn Ân",
      }),
    ).toBe("Trần Thị Bích sits here. Replace with Nguyễn Văn Ân?");
  });
  it("plain assign text when occupantName is null", () => {
    const text = confirmText({
      expectedOccupantId: null,
      occupantName: null,
      memberId: "m1",
      memberName: "Ân",
    });
    expect(text).toBe("Assign Ân to this seat?");
    expect(text).not.toContain("sits here");
  });
});

describe("decideReask", () => {
  const member = { id: "m1", name: "Nguyễn Văn Ân" };
  const ok = (seat: SeatDto) => ({ ok: true as const, value: seat });
  it("a new occupant asks again with that name and id", () => {
    expect(decideReask(ok(occupied("o2", "Lê Văn C")), member)).toEqual({
      kind: "ask",
      seat: occupied("o2", "Lê Văn C"),
      confirm: {
        expectedOccupantId: "o2",
        occupantName: "Lê Văn C",
        memberId: "m1",
        memberName: "Nguyễn Văn Ân",
      },
    });
  });
  it("now empty asks a plain assign confirm", () => {
    const step = decideReask(ok(seatOf()), member);
    expect(step).toMatchObject({
      kind: "ask",
      confirm: { expectedOccupantId: null, occupantName: null },
    });
  });
  it("already the chosen person is done", () => {
    expect(decideReask(ok(occupied("m1")), member)).toEqual({ kind: "done" });
  });
  it("chosen AND cannot-seat is done", () => {
    expect(decideReask(ok({ ...occupied("m1"), cannotSeat: true }), member)).toEqual({
      kind: "done",
    });
  });
  it("cannot-seat closes with the reason", () => {
    expect(decideReask(ok(seatOf({ cannotSeat: true })), member)).toEqual({ kind: "cannotSeat" });
  });
  it("a failed refetch is an error and never an ask", () => {
    expect(decideReask(fail("unavailable"), member)).toEqual({
      kind: "error",
      code: "unavailable",
    });
  });
});

describe("assign dialog transitions", () => {
  const dialog: AssignDialog = {
    kind: "assign",
    seat: occupied(),
    confirm: {
      expectedOccupantId: "o1",
      occupantName: "Trần Thị Bích",
      memberId: "m1",
      memberName: "Ân",
    },
    revision: 3,
    error: null,
    reloadToken: 5,
  };
  it("reaskDialog replaces seat and snapshot, bumps revision, keeps the picker", () => {
    const seat = occupied("o2", "Lê");
    const confirm = {
      expectedOccupantId: "o2",
      occupantName: "Lê",
      memberId: "m1",
      memberName: "Ân",
    };
    const next = reaskDialog({ ...dialog, error: "old" }, seat, confirm);
    expect(next).toMatchObject({ kind: "assign", seat, confirm, revision: 4, error: null });
    expect(next.reloadToken).toBe(5);
  });
  it("refusedDialog clears confirm, sets the error, bumps reloadToken", () => {
    expect(refusedDialog(dialog, "gone")).toMatchObject({
      confirm: null,
      error: "gone",
      reloadToken: 6,
      revision: 3,
    });
  });
});

describe("actionOutcome assign", () => {
  it("ok reloads and keeps the panel", () => {
    expect(actionOutcome("assign", { ok: true })).toEqual({
      reload: true,
      closePanel: false,
      message: null,
    });
  });
  it("auth and invalid_request do not reload", () => {
    for (const code of [...AUTH, "invalid_request"]) {
      expect(actionOutcome("assign", fail(code))).toEqual({
        reload: false,
        closePanel: false,
        message: apiCopy.errors[code as keyof typeof apiCopy.errors],
      });
    }
  });
  it("member_not_assignable keeps the dialog", () => {
    expect(actionOutcome("assign", fail("member_not_assignable"))).toEqual({
      reload: true,
      closePanel: false,
      message: seatsCopy.actions.memberGone,
      keepDialog: true,
    });
  });
  it("not_found closes the panel; seat_cannot_seat reloads with a message", () => {
    expect(actionOutcome("assign", fail("not_found"))).toMatchObject({
      reload: true,
      closePanel: true,
    });
    expect(actionOutcome("assign", fail("seat_cannot_seat"))).toEqual({
      reload: true,
      closePanel: false,
      message: apiCopy.errors.seat_cannot_seat,
    });
  });
  it("never gets Release copy and never keeps the dialog otherwise", () => {
    for (const code of ["occupant_changed", "not_allowed", "unavailable", "internal"]) {
      const out = actionOutcome("assign", fail(code));
      expect(out.message).not.toBe(seatsCopy.actions.releaseChanged);
      expect(out.keepDialog).toBeUndefined();
    }
  });
});

describe("seatButtons: remove and cannot-seat", () => {
  it("gating by tier and seat state", () => {
    for (const tier of [null, undefined, "user"] as const) {
      for (const s of [seatOf(), occupied(), seatOf({ cannotSeat: true })]) {
        const b = seatButtons(tier, s);
        expect([b.removeOccupant, b.setCannotSeat, b.clearCannotSeat]).toEqual([
          false,
          false,
          false,
        ]);
      }
    }
    for (const tier of ["manager", "admin"] as const) {
      const empty = seatButtons(tier, seatOf());
      expect([empty.removeOccupant, empty.setCannotSeat, empty.clearCannotSeat]).toEqual([
        false,
        true,
        false,
      ]);
      const full = seatButtons(tier, occupied());
      expect(full.removeOccupant).toBe(true);
      const blocked = seatButtons(tier, { ...occupied(), cannotSeat: true });
      expect([blocked.removeOccupant, blocked.setCannotSeat, blocked.clearCannotSeat]).toEqual([
        true,
        false,
        true,
      ]);
    }
  });
  it("mine seat: Release, not Remove", () => {
    for (const tier of ["manager", "admin"] as const) {
      const b = seatButtons(tier, { ...occupied(), mine: true });
      expect(b.release).toBe(true);
      expect(b.removeOccupant).toBe(false);
    }
  });
});

describe("removeDialog", () => {
  it("snapshots the occupant id and name; null for an empty seat", () => {
    expect(removeDialog(occupied("o9", "Lê Văn Cường"))).toMatchObject({
      kind: "remove",
      expectedOccupantId: "o9",
      occupantName: "Lê Văn Cường",
    });
    expect(removeDialog(seatOf())).toBeNull();
  });
});

describe("parseCannotSeatReason", () => {
  it("returns the validator's value", () => {
    expect(parseCannotSeatReason("  Ghế hỏng  ")).toEqual({ ok: true, reason: "Ghế hỏng" });
    const nfd = "Ghế hỏng".normalize("NFD");
    expect(parseCannotSeatReason(nfd)).toEqual({ ok: true, reason: "Ghế hỏng".normalize("NFC") });
    expect(parseCannotSeatReason("x".repeat(200))).toEqual({ ok: true, reason: "x".repeat(200) });
  });
  it("refuses bad input", () => {
    for (const bad of ["", "   ", "\n", "​", "a\nb", "x".repeat(201)]) {
      expect(parseCannotSeatReason(bad)).toEqual({ ok: false });
    }
  });
});

describe("actionOutcome new actions", () => {
  const actions = ["removeOccupant", "setCannotSeat", "clearCannotSeat", "setTags"] as const;
  it("success reloads without message", () => {
    for (const a of actions) {
      expect(actionOutcome(a, { ok: true })).toEqual({
        reload: true,
        closePanel: false,
        message: null,
      });
    }
  });
  it("auth and invalid_request never reload", () => {
    for (const a of actions) {
      for (const code of [...AUTH, "invalid_request"]) {
        const out = actionOutcome(a, fail(code));
        expect(out.reload).toBe(false);
        expect(out.closePanel).toBe(false);
      }
    }
  });
  it("not_found closes and reloads", () => {
    for (const a of actions) {
      expect(actionOutcome(a, fail("not_found"))).toEqual({
        reload: true,
        closePanel: true,
        message: seatsCopy.actions.deleteGone,
      });
    }
  });
  it("remove occupant_changed reloads with its own message and no keepDialog", () => {
    const out = actionOutcome("removeOccupant", fail("occupant_changed"));
    expect(out).toEqual({
      reload: true,
      closePanel: false,
      message: seatsCopy.actions.removeChanged,
    });
    expect(out.keepDialog).toBeUndefined();
  });
  it("transient failures reload with the API message", () => {
    for (const a of actions) {
      for (const code of ["unavailable", "internal"]) {
        const out = actionOutcome(a, fail(code));
        expect(out.reload).toBe(true);
        expect(out.closePanel).toBe(false);
        expect(out.message).toBe(apiErrorMessage(code));
      }
    }
  });
});

describe("request", () => {
  it("seatButtons.request: user only, empty, not cannot-seat", () => {
    const cases: [string, ReturnType<typeof seatOf>, boolean][] = [
      ["empty", seatOf(), true],
      ["occupied", occupied(), false],
      [
        "own seat",
        seatOf({ status: "occupied", mine: true, occupant: { id: "me", displayName: "Me" } }),
        false,
      ],
      ["empty and cannot-seat", seatOf({ cannotSeat: true, cannotSeatReason: "x" }), false],
    ];
    for (const tier of ["user", "manager", "admin", null, undefined] as const) {
      for (const [name, seat, userCan] of cases) {
        expect(seatButtons(tier, seat).request, `${tier} ${name}`).toBe(tier === "user" && userCan);
      }
    }
    expect(seatButtons("user", seatOf()).assign).toBeNull();
    expect(seatButtons("admin", seatOf()).deleteSeat).toBe(true);
  });
  it("requestResult maps created/duplicate/failure", () => {
    const request = {} as never;
    expect(requestResult({ ok: true, value: { created: true, request } })).toEqual({ ok: true });
    expect(requestResult({ ok: true, value: { created: false, request } })).toEqual({
      ok: true,
      duplicate: true,
    });
    expect(requestResult(fail("seat_taken"))).toEqual({ ok: false, code: "seat_taken" });
  });
  it("actionOutcome request: sent and duplicate are info notices without reload", () => {
    expect(actionOutcome("request", { ok: true })).toEqual({
      reload: false,
      closePanel: false,
      message: null,
      info: seatsCopy.actions.requestSent,
    });
    expect(actionOutcome("request", { ok: true, duplicate: true })).toEqual({
      reload: false,
      closePanel: false,
      message: null,
      info: seatsCopy.actions.requestDuplicate,
    });
  });
  it("actionOutcome request failures", () => {
    for (const code of [
      "seat_taken",
      "seat_cannot_seat",
      "unavailable",
      "internal",
      "not_allowed",
    ]) {
      expect(actionOutcome("request", fail(code))).toEqual({
        reload: true,
        closePanel: false,
        message: apiErrorMessage(code),
      });
    }
    expect(actionOutcome("request", fail("not_found"))).toEqual({
      reload: true,
      closePanel: true,
      message: seatsCopy.actions.deleteGone,
    });
    for (const code of ["no_linked_member", "member_not_assignable", ...AUTH, "invalid_request"]) {
      expect(actionOutcome("request", fail(code))).toEqual({
        reload: false,
        closePanel: false,
        message: apiErrorMessage(code),
      });
    }
  });
  it("other actions still reload on success and delete still closes the panel", () => {
    expect(actionOutcome("assign", { ok: true })).toMatchObject({
      reload: true,
      closePanel: false,
    });
    expect(actionOutcome("delete", { ok: true })).toMatchObject({ reload: true, closePanel: true });
    expect(actionOutcome("release", { ok: true }).info).toBeUndefined();
  });
});
