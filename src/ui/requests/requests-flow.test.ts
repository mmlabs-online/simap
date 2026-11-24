import { describe, expect, it } from "vitest";
import type { RequestDto, RequestListItemDto, RequestStatus } from "@/lib/requests/types";
import { apiErrorMessage } from "../copy/api";
import { requestsCopy } from "../copy/requests";
import { rivalNames, settleDecision } from "./requests-flow";

const ok = (status: RequestStatus) => ({
  ok: true as const,
  value: { id: "1", status } as RequestDto,
});
const err = (code: string) => ({ ok: false as const, code });
const item = (id: string, over: Partial<RequestListItemDto> = {}): RequestListItemDto => ({
  id,
  status: "pending",
  seat: { id: "s1", code: "A1", roomId: "r1", roomCode: "R1" },
  subject: { id: `u${id}`, displayName: `User ${id}` },
  createdAt: "2026-03-05T17:30:00.000000Z",
  decidedAt: null,
  decidedBy: null,
  currentOccupant: null,
  ...over,
});

describe("settleDecision", () => {
  it("approve -> approved and reject -> rejected close, reload, success notice (status tone), no dialog error", () => {
    expect(settleDecision("approve", ok("approved"))).toEqual({
      close: true,
      reload: true,
      notice: { tone: "status", text: requestsCopy.decision.approved },
      dialogError: null,
    });
    expect(settleDecision("reject", ok("rejected"))).toEqual({
      close: true,
      reload: true,
      notice: { tone: "status", text: requestsCopy.decision.rejected },
      dialogError: null,
    });
  });
  it("ok with another status closes, reloads, notice 'This request was already <status>.'", () => {
    const cases = [
      ["approve", "rejected"],
      ["approve", "cancelled"],
      ["reject", "approved"],
    ] as const;
    for (const [action, status] of cases) {
      expect(settleDecision(action, ok(status))).toEqual({
        close: true,
        reload: true,
        notice: { tone: "status", text: `This request was already ${status}.` },
        dialogError: null,
      });
    }
  });
  it("not_found closes, reloads, error notice apiErrorMessage('not_found')", () => {
    expect(settleDecision("approve", err("not_found"))).toEqual({
      close: true,
      reload: true,
      notice: { tone: "error", text: apiErrorMessage("not_found") },
      dialogError: null,
    });
  });
  it("seat_taken, seat_cannot_seat, member_not_assignable keep dialog open, reload in background, dialogError = apiErrorMessage(code), no notice", () => {
    for (const code of ["seat_taken", "seat_cannot_seat", "member_not_assignable"]) {
      expect(settleDecision("approve", err(code))).toEqual({
        close: false,
        reload: true,
        notice: null,
        dialogError: apiErrorMessage(code),
      });
    }
  });
  it("each auth code and invalid_request keep dialog open, no reload, dialogError", () => {
    for (const code of [
      "unauthenticated",
      "forbidden",
      "member_deactivated",
      "org_required",
      "invalid_request",
    ]) {
      expect(settleDecision("reject", err(code))).toEqual({
        close: false,
        reload: false,
        notice: null,
        dialogError: apiErrorMessage(code),
      });
    }
  });
  it("unavailable, internal and an unknown code keep dialog open, no reload, dialogError (unknown -> internal text)", () => {
    for (const code of ["unavailable", "internal", "weird_code"]) {
      const o = settleDecision("approve", err(code));
      expect(o).toMatchObject({ close: false, reload: false, notice: null });
      expect(o.dialogError).toBe(apiErrorMessage(code));
    }
    expect(settleDecision("approve", err("weird_code")).dialogError).toBe(
      apiErrorMessage("internal"),
    );
  });
});

describe("rivalNames", () => {
  it("other pending requests on the same seat.id, excluding the target; decided rows and other seats ignored; empty when none", () => {
    const target = item("1");
    const items = [
      target,
      item("2"),
      item("3", { status: "approved" }),
      item("4", { seat: { id: "s2", code: "B1", roomId: "r1", roomCode: "R1" } }),
      item("5"),
    ];
    expect(rivalNames(items, target)).toEqual(["User 2", "User 5"]);
    expect(rivalNames([target], target)).toEqual([]);
  });
});
