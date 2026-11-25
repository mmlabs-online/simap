import { describe, expect, it } from "vitest";
import type { Tier } from "@/lib/auth/tier";
import {
  canCancelHandoff,
  canStartTransfer,
  canTakeBack,
  decideExtensionStart,
  decideHandoffAction,
  decideReturnStart,
  decideTransferStart,
  handoffFlags,
} from "./handoff-rules";
import type { HandoffStatus } from "./types";

const base = {
  tier: "user" as Tier,
  actorMemberId: "me",
  ownerId: "me",
  toMemberId: "them",
  recipientActive: true,
  pending: false,
};

describe("permission helpers", () => {
  it("start: owner or Manager+", () => {
    expect(canStartTransfer("user", true)).toBe(true);
    expect(canStartTransfer("user", false)).toBe(false);
    expect(canStartTransfer("manager", false)).toBe(true);
    expect(canStartTransfer("admin", false)).toBe(true);
  });
  it("cancel: sender or Manager+", () => {
    expect(canCancelHandoff("user", true)).toBe(true);
    expect(canCancelHandoff("user", false)).toBe(false);
    expect(canCancelHandoff("manager", false)).toBe(true);
  });
});

describe("decideTransferStart", () => {
  it("lets a user start a transfer of their own device", () => {
    expect(decideTransferStart(base)).toEqual({ kind: "ok" });
  });
  it("refuses a user on someone else's device, even an unowned one", () => {
    const r = { kind: "refuse", status: 422, code: "not_allowed" };
    expect(decideTransferStart({ ...base, ownerId: "x" })).toEqual(r);
    expect(decideTransferStart({ ...base, ownerId: null })).toEqual(r);
  });
  it("lets a manager and an admin start for any owned device", () => {
    for (const tier of ["manager", "admin"] as const) {
      expect(decideTransferStart({ ...base, tier, ownerId: "x" })).toEqual({ kind: "ok" });
    }
  });
  it("refuses an unowned device for a manager", () => {
    expect(decideTransferStart({ ...base, tier: "manager", ownerId: null })).toEqual({
      kind: "refuse",
      status: 422,
      code: "device_unowned",
    });
  });
  it("refuses an actor without a member id", () => {
    expect(decideTransferStart({ ...base, tier: "admin", actorMemberId: null })).toMatchObject({
      code: "not_allowed",
    });
  });
  it("refuses the owner as recipient", () => {
    expect(decideTransferStart({ ...base, toMemberId: "me" })).toMatchObject({
      status: 422,
      code: "invalid_recipient",
    });
  });
  it("refuses a missing or inactive recipient", () => {
    expect(decideTransferStart({ ...base, recipientActive: false })).toMatchObject({
      status: 422,
      code: "member_not_assignable",
    });
  });
  it("refuses a second pending handoff with 409", () => {
    expect(decideTransferStart({ ...base, pending: true })).toEqual({
      kind: "refuse",
      status: 409,
      code: "handoff_pending",
    });
  });
  it("checks in order: permission, owner, recipient, pending", () => {
    const all = { ...base, ownerId: "x", recipientActive: false, pending: true };
    expect(decideTransferStart(all)).toMatchObject({ code: "not_allowed" });
    expect(decideTransferStart({ ...all, tier: "manager" })).toMatchObject({
      code: "member_not_assignable",
    });
    expect(decideTransferStart({ ...all, tier: "manager", recipientActive: true })).toMatchObject({
      code: "handoff_pending",
    });
  });
});

describe("decideHandoffAction", () => {
  const callers = [
    { who: "recipient user", tier: "user", actorMemberId: "to" },
    { who: "sender user", tier: "user", actorMemberId: "from" },
    { who: "other user", tier: "user", actorMemberId: "x" },
    { who: "manager", tier: "manager", actorMemberId: "x" },
    { who: "admin", tier: "admin", actorMemberId: "x" },
    { who: "no member id", tier: "admin", actorMemberId: null },
  ] as const;
  const allowed = {
    confirm: ["recipient user"],
    decline: ["recipient user"],
    cancel: ["sender user", "manager", "admin"],
  };
  for (const action of ["confirm", "decline", "cancel"] as const) {
    for (const c of callers) {
      it(`${action} by ${c.who}`, () => {
        const r = decideHandoffAction({
          kind: "transfer",
          action,
          tier: c.tier,
          actorMemberId: c.actorMemberId,
          fromId: "from",
          toId: "to",
          status: "pending",
        });
        const ok = (allowed[action] as readonly string[]).includes(c.who);
        expect(r).toEqual(
          ok ? { kind: "ok" } : { kind: "refuse", status: 422, code: "not_allowed" },
        );
      });
    }
  }
  it("refuses any action on a decided handoff with 409, after the permission check", () => {
    for (const status of ["confirmed", "declined", "cancelled"] as HandoffStatus[]) {
      const a = {
        kind: "transfer" as const,
        tier: "user" as Tier,
        fromId: "from",
        toId: "to",
        status,
      };
      expect(decideHandoffAction({ ...a, action: "confirm", actorMemberId: "to" })).toEqual({
        kind: "refuse",
        status: 409,
        code: "handoff_not_pending",
      });
      expect(decideHandoffAction({ ...a, action: "confirm", actorMemberId: "x" })).toMatchObject({
        status: 422,
        code: "not_allowed",
      });
    }
  });
});

describe("viewer flags", () => {
  const h = {
    kind: "transfer" as const,
    fromId: "from",
    toId: "to",
    status: "pending" as HandoffStatus,
  };
  it("is false for everything unless pending", () => {
    expect(handoffFlags({ ...h, tier: "admin", actorMemberId: "to", status: "confirmed" })).toEqual(
      {
        canCancel: false,
        canConfirm: false,
        canDecline: false,
      },
    );
  });
  it("gives a manager who is also the recipient all three", () => {
    expect(handoffFlags({ ...h, tier: "manager", actorMemberId: "to" })).toEqual({
      canCancel: true,
      canConfirm: true,
      canDecline: true,
    });
  });
  it("gives the sender cancel only", () => {
    expect(handoffFlags({ ...h, tier: "user", actorMemberId: "from" })).toEqual({
      canCancel: true,
      canConfirm: false,
      canDecline: false,
    });
  });
});

describe("decideReturnStart", () => {
  const r = { tier: "user" as Tier, actorMemberId: "me", ownerId: "me", pending: false };
  const refuse = (status: number, code: string) => ({ kind: "refuse", status, code });
  it("lets the owner and any Manager+ start on an owned device", () => {
    expect(decideReturnStart(r)).toEqual({ kind: "ok" });
    expect(decideReturnStart({ ...r, tier: "manager", ownerId: "x" })).toEqual({ kind: "ok" });
    expect(decideReturnStart({ ...r, tier: "admin", ownerId: "x" })).toEqual({ kind: "ok" });
  });
  it("refuses a user who is not the owner, also on an unowned device, and a missing member", () => {
    expect(decideReturnStart({ ...r, ownerId: "x" })).toEqual(refuse(422, "not_allowed"));
    expect(decideReturnStart({ ...r, ownerId: null })).toEqual(refuse(422, "not_allowed"));
    expect(decideReturnStart({ ...r, actorMemberId: null })).toEqual(refuse(422, "not_allowed"));
  });
  it("orders permission, then unowned, then pending", () => {
    expect(decideReturnStart({ ...r, tier: "manager", ownerId: null })).toEqual(
      refuse(422, "device_unowned"),
    );
    expect(decideReturnStart({ ...r, pending: true })).toEqual(refuse(409, "handoff_pending"));
    expect(decideReturnStart({ ...r, ownerId: "x", pending: true })).toEqual(
      refuse(422, "not_allowed"),
    );
  });
});

describe("decideHandoffAction kind=return", () => {
  const a = { kind: "return" as const, fromId: "from", toId: null, status: "pending" as const };
  const callers = [
    { who: "admin", tier: "admin", me: "x" },
    { who: "admin owner", tier: "admin", me: "from" },
    { who: "manager", tier: "manager", me: "x" },
    { who: "owner user", tier: "user", me: "from" },
    { who: "other user", tier: "user", me: "x" },
    { who: "no member", tier: "admin", me: null },
  ] as const;
  it("confirm: an Admin only", () => {
    for (const c of callers) {
      const r = decideHandoffAction({ ...a, action: "confirm", tier: c.tier, actorMemberId: c.me });
      expect(r.kind === "ok").toBe(c.who === "admin" || c.who === "admin owner");
    }
  });
  it("decline is never allowed; cancel is the owner or a Manager+", () => {
    for (const c of callers) {
      const d = decideHandoffAction({ ...a, action: "decline", tier: c.tier, actorMemberId: c.me });
      expect(d).toEqual({ kind: "refuse", status: 422, code: "not_allowed" });
      const x = decideHandoffAction({ ...a, action: "cancel", tier: c.tier, actorMemberId: c.me });
      expect(x.kind === "ok").toBe(c.who !== "other user" && c.who !== "no member");
    }
  });
  it("is 409 after the permission check when not pending", () => {
    expect(
      decideHandoffAction({
        ...a,
        action: "confirm",
        tier: "admin",
        actorMemberId: "x",
        status: "cancelled",
      }),
    ).toEqual({ kind: "refuse", status: 409, code: "handoff_not_pending" });
  });
  it("flags: an Admin can confirm, nobody can decline", () => {
    expect(handoffFlags({ ...a, tier: "admin", actorMemberId: "x" })).toEqual({
      canCancel: true,
      canConfirm: true,
      canDecline: false,
    });
  });
});

describe("decideExtensionStart", () => {
  const ok = { actorMemberId: "o", ownerId: "o", pending: false };
  it("the owner may ask", () => {
    expect(decideExtensionStart(ok)).toEqual({ kind: "ok" });
  });
  it("a non-owner (user or manager) and a missing member are not allowed", () => {
    expect(decideExtensionStart({ ...ok, actorMemberId: "x" })).toEqual({
      kind: "refuse",
      status: 422,
      code: "not_allowed",
    });
    expect(decideExtensionStart({ ...ok, actorMemberId: null })).toEqual({
      kind: "refuse",
      status: 422,
      code: "not_allowed",
    });
  });
  it("an unowned device is refused; a pending handoff is 409; permission comes before pending", () => {
    expect(decideExtensionStart({ ...ok, ownerId: null })).toEqual({
      kind: "refuse",
      status: 422,
      code: "device_unowned",
    });
    expect(decideExtensionStart({ ...ok, pending: true })).toEqual({
      kind: "refuse",
      status: 409,
      code: "handoff_pending",
    });
    expect(decideExtensionStart({ ...ok, actorMemberId: "x", pending: true })).toMatchObject({
      status: 422,
      code: "not_allowed",
    });
  });
});

describe("decideHandoffAction extension", () => {
  const ext = {
    kind: "extension" as const,
    fromId: "from",
    toId: null,
    status: "pending" as const,
  };
  const run = (action: "confirm" | "decline" | "cancel", tier: Tier, me: string | null) =>
    decideHandoffAction({ ...ext, action, tier, actorMemberId: me }).kind === "ok";
  it("confirm and decline: Manager and Admin only, not the owner", () => {
    for (const action of ["confirm", "decline"] as const) {
      expect(run(action, "manager", "x")).toBe(true);
      expect(run(action, "admin", "x")).toBe(true);
      expect(run(action, "user", "from")).toBe(false);
      expect(run(action, "user", "x")).toBe(false);
      expect(run(action, "manager", null)).toBe(false);
    }
  });
  it("cancel: the owner or a Manager+", () => {
    expect(run("cancel", "user", "from")).toBe(true);
    expect(run("cancel", "manager", "x")).toBe(true);
    expect(run("cancel", "user", "x")).toBe(false);
  });
  it("is 409 when not pending, after the permission check", () => {
    expect(
      decideHandoffAction({
        ...ext,
        action: "confirm",
        tier: "manager",
        actorMemberId: "x",
        status: "confirmed",
      }),
    ).toEqual({ kind: "refuse", status: 409, code: "handoff_not_pending" });
    expect(
      decideHandoffAction({
        ...ext,
        action: "confirm",
        tier: "user",
        actorMemberId: "x",
        status: "confirmed",
      }),
    ).toMatchObject({ status: 422, code: "not_allowed" });
  });
  it("flags per role", () => {
    expect(handoffFlags({ ...ext, tier: "manager", actorMemberId: "x" })).toEqual({
      canCancel: true,
      canConfirm: true,
      canDecline: true,
    });
    expect(handoffFlags({ ...ext, tier: "user", actorMemberId: "from" })).toEqual({
      canCancel: true,
      canConfirm: false,
      canDecline: false,
    });
  });
});

describe("canTakeBack", () => {
  it("Admin, owned, and no pending return", () => {
    expect(canTakeBack("admin", "o", null)).toBe(true);
    expect(canTakeBack("admin", "o", "transfer")).toBe(true);
    expect(canTakeBack("admin", "o", "return")).toBe(false);
    expect(canTakeBack("admin", null, null)).toBe(false);
    expect(canTakeBack("manager", "o", null)).toBe(false);
  });
});
