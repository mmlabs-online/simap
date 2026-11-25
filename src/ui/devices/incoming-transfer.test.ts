import { describe, expect, it } from "vitest";
import type { HandoffDto } from "@/lib/devices/types";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import {
  INITIAL_INCOMING,
  badgeCountAfter,
  badgeTotal,
  confirmOutcome,
  declineOutcome,
  fetcherFor,
  focusAfter,
  handoffBoxes,
  incomingReducer,
} from "./incoming-transfer";

const item = (id: string, over: Partial<HandoffDto> = {}): HandoffDto => ({
  id,
  kind: "transfer",
  status: "pending",
  device: {
    id: `d-${id}`,
    name: "Máy trạm",
    type: "PC",
    inventoryNumber: "INV-1",
    expiresOn: null,
  },
  from: { id: "m1", displayName: "Nguyễn Thị Hà" },
  to: { id: "m2", displayName: "Trần Văn Bình" },
  requestedBy: { id: "m1", displayName: "Nguyễn Thị Hà" },
  decidedBy: null,
  note: null,
  newExpiresOn: null,
  createdAt: "2026-11-25T00:00:00Z",
  decidedAt: null,
  canCancel: false,
  canConfirm: true,
  canDecline: true,
  ...over,
});
const ok = { ok: true as const, value: item("h1") };
const err = (code: string) => ({ ok: false as const, code });
const c = devicesCopy.incoming;

describe("confirmOutcome", () => {
  it("ok: status notice names device and inventory number, says not placed, refresh", () => {
    const o = confirmOutcome(ok, item("h1"), "all");
    expect(o.refresh).toBe(true);
    expect(o.notice).toEqual({ tone: "status", text: c.confirmed("Máy trạm", "INV-1") });
    expect(o.notice.text).toContain("not placed");
  });
  it("filter hint only when the filter is placed or unowned (not all, not inventory)", () => {
    for (const f of ["placed", "unowned"] as const) {
      expect(confirmOutcome(ok, item("h1"), f).notice.text).toContain(c.filterHint);
    }
    for (const f of ["all", "inventory"] as const) {
      expect(confirmOutcome(ok, item("h1"), f).notice.text).not.toContain(c.filterHint);
    }
  });
  it("handoff_not_pending, handoff_stale, not_found: status transfer.gone, refresh", () => {
    for (const code of ["handoff_not_pending", "handoff_stale", "not_found"]) {
      expect(confirmOutcome(err(code), item("h1"), "all")).toEqual({
        refresh: true,
        notice: { tone: "status", text: devicesCopy.transfer.gone },
      });
      expect(declineOutcome(err(code), item("h1"))).toEqual({
        refresh: true,
        notice: { tone: "status", text: devicesCopy.transfer.gone },
      });
    }
  });
  it("auth codes, unavailable, internal, invalid_request: error notice, no refresh", () => {
    for (const code of [
      "unauthenticated",
      "forbidden",
      "member_deactivated",
      "org_required",
      "unavailable",
      "internal",
      "invalid_request",
    ]) {
      const o = confirmOutcome(err(code), item("h1"), "all");
      expect(o).toEqual({
        refresh: false,
        notice: { tone: "error", text: apiErrorMessage(code) },
      });
      expect(declineOutcome(err(code), item("h1")).refresh).toBe(false);
    }
  });
  it("not_allowed, member_not_assignable, placement_changed: error notice with apiErrorMessage, refresh", () => {
    for (const code of ["not_allowed", "member_not_assignable", "placement_changed"]) {
      expect(confirmOutcome(err(code), item("h1"), "all")).toEqual({
        refresh: true,
        notice: { tone: "error", text: apiErrorMessage(code) },
      });
    }
  });
});

describe("declineOutcome", () => {
  it("ok: status notice, refresh", () => {
    expect(declineOutcome(ok, item("h1"))).toEqual({
      refresh: true,
      notice: { tone: "status", text: c.declined("Máy trạm", "INV-1") },
    });
  });
});

describe("focusAfter", () => {
  const [a, b, d] = [item("a"), item("b"), item("d")];
  it("next item's confirm when it is still in the new list", () => {
    expect(focusAfter([a, b, d], "a", [b, d], "incoming")).toEqual({ kind: "confirm", id: "b" });
  });
  it("removed was last: section of the acting list when items remain, else page", () => {
    expect(focusAfter([a, b], "b", [a], "returns")).toEqual({ kind: "section", list: "returns" });
    expect(focusAfter([a], "a", [], "incoming")).toEqual({ kind: "page" });
  });
  it("next item missing from the new list: section", () => {
    expect(focusAfter([a, b, d], "a", [d], "incoming")).toEqual({
      kind: "section",
      list: "incoming",
    });
  });
  it("next item without canConfirm: section", () => {
    expect(focusAfter([a, b], "a", [item("b", { canConfirm: false })], "returns")).toEqual({
      kind: "section",
      list: "returns",
    });
  });
});

describe("badgeCountAfter", () => {
  it("ok count wins; failed count with both lists -> their lengths; one list null -> null", () => {
    const counts = { incoming: 4, returns: 1, extensions: 0, overdue: 0 };
    expect(badgeCountAfter({ ok: true, value: counts }, [item("a")], [], [])).toEqual(counts);
    expect(
      badgeCountAfter(err("internal"), [item("a"), item("b")], [item("c")], [item("d")]),
    ).toEqual({ incoming: 2, returns: 1, extensions: 1, overdue: 0 });
    expect(badgeCountAfter(err("internal"), null, [], [])).toBeNull();
    expect(badgeCountAfter(err("internal"), [], null, [])).toBeNull();
    expect(badgeCountAfter(err("internal"), [], [], null)).toBeNull();
    expect(badgeCountAfter({ ok: true, value: counts }, null, null, null)).toEqual(counts);
  });
});

describe("badgeTotal", () => {
  it("sums incoming, returns, extensions and overdue", () => {
    expect(badgeTotal({ incoming: 2, returns: 3, extensions: 4, overdue: 1 })).toBe(10);
  });
});

describe("handoffBoxes", () => {
  it("user -> incoming; manager -> + extensions; admin -> incoming, returns, extensions", () => {
    expect(handoffBoxes(false, false)).toEqual(["incoming"]);
    expect(handoffBoxes(false, true)).toEqual(["incoming", "extensions"]);
    expect(handoffBoxes(true, true)).toEqual(["incoming", "returns", "extensions"]);
  });
});

describe("fetcherFor", () => {
  it("maps each box to its own API call", () => {
    const api = {
      incomingHandoffs: () => Promise.resolve(err("a")),
      pendingReturns: () => Promise.resolve(err("b")),
      pendingExtensions: () => Promise.resolve(err("c")),
    };
    expect(fetcherFor(api, "incoming")).toBe(api.incomingHandoffs);
    expect(fetcherFor(api, "returns")).toBe(api.pendingReturns);
    expect(fetcherFor(api, "extensions")).toBe(api.pendingExtensions);
  });
});

describe("incomingReducer", () => {
  const list = (items: HandoffDto[]) => ({ ok: true as const, value: { items, truncated: false } });
  it("load, then loaded: ready with items", () => {
    const loading = incomingReducer(INITIAL_INCOMING, { type: "load", id: 1 });
    const s = incomingReducer(loading, { type: "loaded", id: 1, result: list([item("a")]) });
    expect(s).toMatchObject({ status: "ready", errorCode: null });
    expect(s.items).toHaveLength(1);
  });
  it("a failed first load is an error with no items", () => {
    const loading = incomingReducer(INITIAL_INCOMING, { type: "load", id: 1 });
    const s = incomingReducer(loading, { type: "loaded", id: 1, result: err("unavailable") });
    expect(s).toMatchObject({ status: "error", errorCode: "unavailable", items: [] });
  });
  it("a failed refresh keeps the items and sets errorCode", () => {
    let s = incomingReducer(INITIAL_INCOMING, { type: "load", id: 1 });
    s = incomingReducer(s, { type: "loaded", id: 1, result: list([item("a")]) });
    s = incomingReducer(s, { type: "refresh", id: 2 });
    s = incomingReducer(s, { type: "loaded", id: 2, result: err("unavailable") });
    expect(s.items).toHaveLength(1);
    expect(s.errorCode).toBe("unavailable");
  });
  it("an answer for a stale id is ignored", () => {
    let s = incomingReducer(INITIAL_INCOMING, { type: "load", id: 2 });
    s = incomingReducer(s, { type: "loaded", id: 1, result: list([item("a")]) });
    expect(s.status).toBe("loading");
  });
});
