import { describe, expect, it } from "vitest";
import type { DeviceDto, DeviceHistoryEntryDto, DeviceHistoryPage } from "@/lib/devices/types";
import {
  INITIAL_DETAIL,
  INITIAL_HISTORY,
  detailReducer,
  historyReducer,
  type HistoryState,
} from "./device-detail-state";

const device = { id: "d1", name: "Laptop" } as DeviceDto;
const entry = (id: string) => ({ id, kind: "create" }) as DeviceHistoryEntryDto;
const pageOf = (ids: string[], nextCursor: string | null = null): DeviceHistoryPage => ({
  items: ids.map(entry),
  nextCursor,
  holderSince: null,
});
const ok = <T>(value: T) => ({ ok: true as const, value });
const fail = (code: string) => ({ ok: false as const, code });

describe("detailReducer", () => {
  it("load -> ready; not_found -> notFound; other code -> error; stale id dropped", () => {
    const loading = detailReducer(INITIAL_DETAIL, { type: "load", id: 1 });
    expect(loading.status).toBe("loading");
    expect(detailReducer(loading, { type: "loaded", id: 1, result: ok(device) })).toMatchObject({
      status: "ready",
      device,
    });
    const nf = detailReducer(loading, { type: "loaded", id: 1, result: fail("not_found") });
    expect(nf).toMatchObject({ status: "notFound", device: null });
    const bad = detailReducer(loading, { type: "loaded", id: 1, result: fail("unavailable") });
    expect(bad).toMatchObject({ status: "error", errorCode: "unavailable" });
    const second = detailReducer(loading, { type: "load", id: 2 });
    expect(detailReducer(second, { type: "loaded", id: 1, result: ok(device) })).toBe(second);
  });
});

describe("historyReducer", () => {
  const ready = (): HistoryState => {
    const s = historyReducer(INITIAL_HISTORY, { type: "load", id: 1 });
    return historyReducer(s, { type: "loaded", id: 1, result: ok(pageOf(["a", "b"], "c1")) });
  };

  it("first page, loadMore appends, failed loadMore keeps items and sets moreError, stale id dropped, retry resets", () => {
    const s1 = ready();
    expect(s1).toMatchObject({ status: "ready", nextCursor: "c1", loadingMore: false });
    expect(s1.items.map((i) => i.id)).toEqual(["a", "b"]);

    const more = historyReducer(s1, { type: "loadMore", id: 2 });
    expect(more.loadingMore).toBe(true);
    const s2 = historyReducer(more, { type: "moreLoaded", id: 2, result: ok(pageOf(["c"])) });
    expect(s2.items.map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(s2).toMatchObject({ nextCursor: null, loadingMore: false });

    const failed = historyReducer(more, { type: "moreLoaded", id: 2, result: fail("unavailable") });
    expect(failed).toMatchObject({ loadingMore: false, moreError: true, nextCursor: "c1" });
    expect(failed.items).toHaveLength(2);

    const stale = historyReducer(more, { type: "moreLoaded", id: 1, result: ok(pageOf(["z"])) });
    expect(stale).toBe(more);

    const err = historyReducer(INITIAL_HISTORY, { type: "load", id: 3 });
    const errored = historyReducer(err, { type: "loaded", id: 3, result: fail("internal") });
    expect(errored).toMatchObject({ status: "error", errorCode: "internal", items: [] });
    expect(historyReducer(errored, { type: "load", id: 4 })).toMatchObject({
      status: "loading",
      latest: 4,
    });
  });

  it("a load after loadMore drops the late loadMore answer", () => {
    const more = historyReducer(ready(), { type: "loadMore", id: 2 });
    const reset = historyReducer(more, { type: "load", id: 3 });
    const late = historyReducer(reset, { type: "moreLoaded", id: 2, result: ok(pageOf(["z"])) });
    expect(late).toBe(reset);
  });
});

describe("refresh events", () => {
  const readyDetail = () =>
    detailReducer(detailReducer(INITIAL_DETAIL, { type: "load", id: 1 }), {
      type: "loaded",
      id: 1,
      result: ok(device),
    });
  const newer = { id: "d1", name: "Renamed" } as DeviceDto;

  it("detail refresh keeps status/device and only bumps latest", () => {
    const s = detailReducer(readyDetail(), { type: "refresh", id: 2 });
    expect(s).toMatchObject({ status: "ready", device, latest: 2 });
  });

  it("detail refreshed ok replaces the device in place", () => {
    const s = detailReducer(readyDetail(), { type: "refresh", id: 2 });
    expect(detailReducer(s, { type: "refreshed", id: 2, result: ok(newer) })).toMatchObject({
      status: "ready",
      device: newer,
    });
  });

  it("detail refreshed for an older id is dropped", () => {
    const s = detailReducer(readyDetail(), { type: "refresh", id: 3 });
    expect(detailReducer(s, { type: "refreshed", id: 2, result: ok(newer) })).toBe(s);
  });

  it("detail refreshed not_found -> notFound, device null", () => {
    const s = detailReducer(readyDetail(), { type: "refresh", id: 2 });
    expect(detailReducer(s, { type: "refreshed", id: 2, result: fail("not_found") })).toMatchObject(
      { status: "notFound", device: null },
    );
  });

  it("detail refreshed other error keeps status ready and the old device", () => {
    const s = detailReducer(readyDetail(), { type: "refresh", id: 2 });
    expect(detailReducer(s, { type: "refreshed", id: 2, result: fail("unavailable") })).toBe(s);
  });

  it("history refresh keeps items and clears loadingMore; refreshed ok replaces with page 1; failure keeps items; older loadMore dropped", () => {
    let s = historyReducer(INITIAL_HISTORY, { type: "load", id: 1 });
    s = historyReducer(s, { type: "loaded", id: 1, result: ok(pageOf(["a", "b"], "c1")) });
    s = historyReducer(s, { type: "loadMore", id: 2 });
    const r = historyReducer(s, { type: "refresh", id: 3 });
    expect(r).toMatchObject({ loadingMore: false, moreError: false, latest: 3, status: "ready" });
    expect(r.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(historyReducer(r, { type: "moreLoaded", id: 2, result: ok(pageOf(["z"])) })).toBe(r);
    const done = historyReducer(r, {
      type: "refreshed",
      id: 3,
      result: ok({ items: [entry("n")], nextCursor: "c9", holderSince: "2026-01-01" }),
    });
    expect(done.items.map((i) => i.id)).toEqual(["n"]);
    expect(done).toMatchObject({ nextCursor: "c9", holderSince: "2026-01-01", status: "ready" });
    expect(historyReducer(r, { type: "refreshed", id: 3, result: fail("unavailable") })).toBe(r);
  });
});
