import { describe, expect, it } from "vitest";
import {
  REQUEST_STATUSES,
  type MyRequestDto,
  type RequestDto,
  type RequestListItemDto,
} from "@/lib/requests/types";
import { apiErrorMessage } from "../copy/api";
import { requestsCopy } from "../copy/requests";
import {
  appendPage,
  cancelOutcome,
  canViewApprovals,
  formatRequestTime,
  parseStatusParam,
  statusHref,
  statusOptions,
  type ListState,
} from "./requests-state";

const item = (id: string): RequestListItemDto => ({
  id,
  status: "pending",
  seat: { id: "s", code: "A1", roomId: "r", roomCode: "R1" },
  subject: { id: "u", displayName: "Ann" },
  createdAt: "2026-03-05T10:00:00.000000Z",
  decidedAt: null,
  decidedBy: null,
  currentOccupant: null,
});

describe("requests-state", () => {
  it("parseStatusParam: missing, unknown, duplicate -> pending; each valid status kept", () => {
    expect(parseStatusParam([])).toBe("pending");
    expect(parseStatusParam(["approved"])).toBe("approved");
    for (const s of REQUEST_STATUSES) expect(parseStatusParam([s])).toBe(s);
    expect(parseStatusParam(["bogus"])).toBe("pending");
    expect(parseStatusParam(["approved", "rejected"])).toBe("pending");
    expect(parseStatusParam([""])).toBe("pending");
  });
  it("statusHref: pending drops the param, others set ?status=", () => {
    expect(statusHref("/approvals", "pending")).toBe("/approvals");
    expect(statusHref("/approvals", "rejected")).toBe("/approvals?status=rejected");
  });
  it("canViewApprovals: manager/admin true, user/null/undefined false", () => {
    expect(canViewApprovals("admin")).toBe(true);
    expect(canViewApprovals("manager")).toBe(true);
    expect(canViewApprovals("user")).toBe(false);
    expect(canViewApprovals(null)).toBe(false);
    expect(canViewApprovals(undefined)).toBe(false);
  });
  it("statusOptions: four options in REQUEST_STATUSES order with copy labels", () => {
    expect(statusOptions().map((o) => o.value)).toEqual([...REQUEST_STATUSES]);
    expect(statusOptions().map((o) => o.label)).toEqual(
      REQUEST_STATUSES.map((s) => requestsCopy.statusLabel[s]),
    );
  });
  it("appendPage: appends items, takes the new cursor; null cursor -> hasMore false", () => {
    const base: ListState = {
      status: "ready",
      items: [item("1")],
      nextCursor: "c1",
      loadingMore: true,
      errorCode: null,
    };
    const next = appendPage(base, { items: [item("2")], nextCursor: "c2" });
    expect(next.items.map((i) => i.id)).toEqual(["1", "2"]);
    expect(next.nextCursor).toBe("c2");
    expect(next.loadingMore).toBe(false);
    expect(appendPage(base, { items: [], nextCursor: null }).nextCursor).toBeNull();
  });
  it("formatRequestTime: UTC 2026-03-05T17:30:00Z -> '06 Mar 2026, 00:30'; invalid string returned as is", () => {
    expect(formatRequestTime("2026-03-05T17:30:00Z")).toBe("06 Mar 2026, 00:30");
    expect(formatRequestTime("not a time")).toBe("not a time");
  });
  it("appendPage works for MyRequestDto pages", () => {
    const mine = (id: string): MyRequestDto => ({ ...item(id), isNew: true });
    const base: ListState<MyRequestDto> = {
      status: "ready",
      items: [mine("1")],
      nextCursor: "c1",
      loadingMore: true,
      errorCode: null,
    };
    const next = appendPage(base, { items: [mine("2")], nextCursor: null });
    expect(next.items.map((i) => [i.id, i.isNew])).toEqual([
      ["1", true],
      ["2", true],
    ]);
    expect(next.nextCursor).toBeNull();
  });
  describe("cancelOutcome", () => {
    const dto = (status: RequestDto["status"]): RequestDto => {
      const { currentOccupant: _drop, ...rest } = item("1");
      return { ...rest, status };
    };
    it("ok cancelled -> reload and the cancelled text (status tone)", () => {
      expect(cancelOutcome({ ok: true, value: dto("cancelled") })).toEqual({
        reload: true,
        notice: { tone: "status", text: requestsCopy.mine.cancelled },
      });
    });
    it("ok approved or rejected -> reload and the already-decided text", () => {
      for (const s of ["approved", "rejected"] as const) {
        expect(cancelOutcome({ ok: true, value: dto(s) })).toEqual({
          reload: true,
          notice: {
            tone: "status",
            text: requestsCopy.mine.alreadyDecided(requestsCopy.statusLabel[s]),
          },
        });
      }
    });
    it("not_found, unavailable and internal -> reload with the api message as an error", () => {
      for (const code of ["not_found", "unavailable", "internal"]) {
        expect(cancelOutcome({ ok: false, code })).toEqual({
          reload: true,
          notice: { tone: "error", text: apiErrorMessage(code) },
        });
      }
    });
    it("auth codes and invalid_request -> no reload, error", () => {
      for (const code of [
        "unauthenticated",
        "forbidden",
        "member_deactivated",
        "org_required",
        "invalid_request",
      ]) {
        expect(cancelOutcome({ ok: false, code })).toEqual({
          reload: false,
          notice: { tone: "error", text: apiErrorMessage(code) },
        });
      }
    });
  });
});
