import { describe, expect, it } from "vitest";
import type { DeviceDto } from "@/lib/devices/types";
import { devicesCopy } from "../copy/devices";
import { shellCopy } from "../copy/shell";
import {
  INITIAL_DEVICES,
  detailsText,
  devicesReducer,
  emptyText,
  expiryText,
  filterOptions,
  listSummary,
  pendingText,
  placementText,
} from "./devices-state";

const device = { id: "d1" } as DeviceDto;
const okResult = { ok: true as const, value: { items: [device], truncated: true } };

describe("devices-state helpers", () => {
  it("placementText: placed gives 'At seat C302-01'; null gives 'In inventory'", () => {
    expect(
      placementText({
        seatId: "s",
        seatCode: "C302-01",
        roomId: "r",
        roomCode: "C302",
        role: "primary",
      }),
    ).toBe("At seat C302-01");
    expect(placementText(null)).toBe("In inventory");
  });

  it("emptyText: all uses the shell copy; placed and inventory their own", () => {
    expect(emptyText("all")).toBe(shellCopy.pages.devices.empty);
    expect(emptyText("placed")).toBe(devicesCopy.empty.placed);
    expect(emptyText("inventory")).toBe(devicesCopy.empty.inventory);
    expect(emptyText("unowned")).toBe(devicesCopy.empty.unowned);
  });

  it("filterOptions: order all, placed, inventory, unowned (Org inventory) with copy labels", () => {
    expect(filterOptions()).toEqual([
      { value: "all", label: "All" },
      { value: "placed", label: "Placed" },
      { value: "inventory", label: "Not placed" },
      { value: "unowned", label: "Org inventory" },
    ]);
  });

  it("listSummary: 0 / 1 / 12 devices with the filter label", () => {
    expect(listSummary(0, "all")).toBe("0 devices · All");
    expect(listSummary(1, "placed")).toBe("1 device · Placed");
    expect(listSummary(12, "inventory")).toBe("12 devices · Not placed");
  });
});

describe("devicesReducer", () => {
  it("load sets loading and clears items", () => {
    const ready = devicesReducer(devicesReducer(INITIAL_DEVICES, { type: "load", id: 1 }), {
      type: "loaded",
      id: 1,
      result: okResult,
    });
    expect(ready).toMatchObject({ status: "ready", items: [device], truncated: true });
    expect(devicesReducer(ready, { type: "load", id: 2 })).toEqual({
      ...INITIAL_DEVICES,
      latest: 2,
    });
  });

  it("loaded with the latest id is ready or error", () => {
    const loading = devicesReducer(INITIAL_DEVICES, { type: "load", id: 1 });
    expect(devicesReducer(loading, { type: "loaded", id: 1, result: okResult }).status).toBe(
      "ready",
    );
    expect(
      devicesReducer(loading, {
        type: "loaded",
        id: 1,
        result: { ok: false, code: "unavailable" },
      }),
    ).toMatchObject({ status: "error", errorCode: "unavailable", items: [] });
  });

  it("a loaded event with an older id is ignored (filter race)", () => {
    const loading = devicesReducer(devicesReducer(INITIAL_DEVICES, { type: "load", id: 1 }), {
      type: "load",
      id: 2,
    });
    expect(devicesReducer(loading, { type: "loaded", id: 1, result: okResult })).toBe(loading);
  });

  it("refresh keeps rows and status until the answer", () => {
    const ready = devicesReducer(devicesReducer(INITIAL_DEVICES, { type: "load", id: 1 }), {
      type: "loaded",
      id: 1,
      result: okResult,
    });
    expect(devicesReducer(ready, { type: "refresh", id: 2 })).toEqual({ ...ready, latest: 2 });
  });

  it("a refresh answer replaces the rows; a stale answer is ignored", () => {
    const ready = devicesReducer(devicesReducer(INITIAL_DEVICES, { type: "load", id: 1 }), {
      type: "loaded",
      id: 1,
      result: okResult,
    });
    const refreshing = devicesReducer(ready, { type: "refresh", id: 2 });
    const other = { id: "d2" } as DeviceDto;
    expect(
      devicesReducer(refreshing, {
        type: "loaded",
        id: 2,
        result: { ok: true, value: { items: [other], truncated: false } },
      }),
    ).toMatchObject({ status: "ready", items: [other], truncated: false });
    expect(devicesReducer(refreshing, { type: "loaded", id: 1, result: okResult })).toBe(
      refreshing,
    );
  });
});

describe("detailsText and expiryText", () => {
  const dev = (over: Partial<DeviceDto>) =>
    ({ manufacturer: null, brand: null, serial: null, ...over }) as DeviceDto;
  it("detailsText joins manufacturer and brand; serial gets a prefix; nothing gives nulls", () => {
    expect(detailsText(dev({ manufacturer: "Dell", brand: "XPS", serial: "S1" }))).toEqual({
      maker: "Dell XPS",
      serial: "SN: S1",
    });
    expect(detailsText(dev({ brand: "XPS" }))).toEqual({ maker: "XPS", serial: null });
    expect(detailsText(dev({ manufacturer: "Dell" }))).toEqual({ maker: "Dell", serial: null });
    expect(detailsText(dev({ serial: "S1" }))).toEqual({ maker: null, serial: "SN: S1" });
    expect(detailsText(dev({}))).toEqual({ maker: null, serial: null });
  });
  it("expiryText shows the date as given or No expiry", () => {
    expect(expiryText({ expiresOn: "2026-12-31" })).toBe("Until 2026-12-31");
    expect(expiryText({ expiresOn: null })).toBe("No expiry");
  });
});

describe("pendingText", () => {
  const withHandoff = (p: object | null) =>
    ({ id: "d1", pendingHandoff: p }) as unknown as DeviceDto;
  const handoff = (over: object = {}) => ({
    id: "h1",
    kind: "transfer",
    to: { id: "m", displayName: "Hương" },
    ...over,
  });
  it("is null without a handoff and for other kinds", () => {
    expect(pendingText(withHandoff(null))).toBeNull();
    expect(pendingText(withHandoff(handoff({ kind: "return" })))).toBeNull();
    expect(pendingText(withHandoff(handoff({ kind: "extension" })))).toBeNull();
  });
  it("a transfer gives the chip and To <name>, keeping diacritics", () => {
    expect(pendingText(withHandoff(handoff()))).toEqual({
      chip: devicesCopy.pending.chip,
      to: "To Hương",
    });
  });
  it("a transfer without a recipient has the chip only", () => {
    expect(pendingText(withHandoff(handoff({ to: null })))).toEqual({
      chip: devicesCopy.pending.chip,
      to: null,
    });
  });
});
