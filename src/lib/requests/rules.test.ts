import { describe, expect, it } from "vitest";
import {
  decideApprove,
  decideCancel,
  decideCreate,
  isUnseen,
  nextStatus,
  type RequestAction,
} from "./rules";
import { REQUEST_STATUSES } from "./types";

describe("nextStatus", () => {
  it("pending moves on every action", () => {
    expect(nextStatus("pending", "approve")).toBe("approved");
    expect(nextStatus("pending", "reject")).toBe("rejected");
    expect(nextStatus("pending", "cancel")).toBe("cancelled");
  });

  it("terminal states never change", () => {
    const actions: RequestAction[] = ["approve", "reject", "cancel"];
    for (const s of REQUEST_STATUSES.filter((x) => x !== "pending")) {
      for (const a of actions) expect(nextStatus(s, a)).toBeNull();
    }
  });
});

describe("decideCreate", () => {
  it.each([
    [null, false, "create"],
    ["m", false, "refuse_taken"],
    [null, true, "refuse_cannot_seat"],
    ["m", true, "refuse_taken"],
  ] as const)("occupant %s, cannotSeat %s -> %s", (occupantId, cannotSeat, want) => {
    expect(decideCreate({ occupantId, cannotSeat })).toBe(want);
  });
});

describe("decideApprove", () => {
  it("a non-pending request is a no-op whatever the seat looks like", () => {
    for (const status of ["approved", "rejected", "cancelled"] as const) {
      expect(decideApprove({ status, occupantId: "m", cannotSeat: true })).toBe("noop");
    }
  });

  it.each([
    [null, false, "approve"],
    ["m", false, "refuse_taken"],
    [null, true, "refuse_cannot_seat"],
    ["m", true, "refuse_taken"],
  ] as const)("pending, occupant %s, cannotSeat %s -> %s", (occupantId, cannotSeat, want) => {
    expect(decideApprove({ status: "pending", occupantId, cannotSeat })).toBe(want);
  });
});

describe("decideCancel", () => {
  it("not the owner is refused, even when non-pending", () => {
    expect(decideCancel({ status: "pending", isOwner: false })).toBe("refuse");
    expect(decideCancel({ status: "approved", isOwner: false })).toBe("refuse");
  });

  it("owner: pending cancels, anything else is a no-op", () => {
    expect(decideCancel({ status: "pending", isOwner: true })).toBe("cancel");
    for (const status of ["approved", "rejected", "cancelled"] as const) {
      expect(decideCancel({ status, isOwner: true })).toBe("noop");
    }
  });
});

describe("isUnseen", () => {
  const D = "2026-11-24T05:00:00.000100Z";
  const before = "2026-11-24T05:00:00.000099Z";
  const after = "2026-11-24T05:00:00.000101Z";

  it("approved and rejected: unseen iff seenAt is null or earlier than decidedAt", () => {
    for (const s of ["approved", "rejected"] as const) {
      expect(isUnseen(s, D, null)).toBe(true);
      expect(isUnseen(s, D, before)).toBe(true);
      expect(isUnseen(s, D, D)).toBe(false);
      expect(isUnseen(s, D, after)).toBe(false);
    }
  });

  it("pending and cancelled are never unseen", () => {
    for (const s of ["pending", "cancelled"] as const) {
      for (const seen of [null, before, D, after]) expect(isUnseen(s, D, seen)).toBe(false);
    }
  });

  it("a missing decidedAt is never unseen", () => {
    expect(isUnseen("approved", null, null)).toBe(false);
  });
});
