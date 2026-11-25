import type { DeviceDto, DevicePlacementDto, PlacementFilter } from "@/lib/devices/types";
import type { ChipOption } from "../Chip";
import { devicesCopy } from "../copy/devices";
import { shellCopy } from "../copy/shell";
import type { DevicesResult } from "./devices-api";

export const FILTERS: readonly PlacementFilter[] = ["all", "placed", "inventory", "unowned"];

export function filterOptions(): ChipOption<PlacementFilter>[] {
  return FILTERS.map((value) => ({ value, label: devicesCopy.filters[value] }));
}

export function placementText(p: DevicePlacementDto | null): string {
  return p ? devicesCopy.atSeat(p.seatCode) : devicesCopy.inInventory;
}

/** The Details column: manufacturer and brand on one line, the serial on another. */
export function detailsText(d: DeviceDto): { maker: string | null; serial: string | null } {
  const maker = [d.manufacturer, d.brand].filter((x): x is string => x !== null).join(" ");
  return {
    maker: maker === "" ? null : maker,
    serial: d.serial === null ? null : devicesCopy.details.serial(d.serial),
  };
}

/** "Until 2026-12-31" or "No expiry"; the date is shown as given, never through `Date`. */
export function expiryText(h: { expiresOn: string | null }): string {
  return h.expiresOn === null
    ? devicesCopy.holding.noExpiry
    : devicesCopy.holding.until(h.expiresOn);
}

export function emptyText(filter: PlacementFilter): string {
  return filter === "all" ? shellCopy.pages.devices.empty : devicesCopy.empty[filter];
}

export function listSummary(n: number, filter: PlacementFilter): string {
  return devicesCopy.summary(n, devicesCopy.filters[filter]);
}

export type DevicesState = {
  status: "loading" | "error" | "ready";
  items: DeviceDto[];
  truncated: boolean;
  errorCode: string | null;
  latest: number;
};

export const INITIAL_DEVICES: DevicesState = {
  status: "loading",
  items: [],
  truncated: false,
  errorCode: null,
  latest: 0,
};

export type DevicesEvent =
  | { type: "load"; id: number }
  | { type: "refresh"; id: number }
  | {
      type: "loaded";
      id: number;
      result: DevicesResult<{ items: DeviceDto[]; truncated: boolean }>;
    };

/** A load clears the rows, a refresh keeps them until the answer; an answer for an older request (an earlier filter) is ignored. */
export function devicesReducer(state: DevicesState, event: DevicesEvent): DevicesState {
  if (event.type === "load") return { ...INITIAL_DEVICES, latest: event.id };
  if (event.type === "refresh") return { ...state, latest: event.id };
  if (event.id !== state.latest) return state;
  return event.result.ok
    ? {
        status: "ready",
        items: event.result.value.items,
        truncated: event.result.value.truncated,
        errorCode: null,
        latest: state.latest,
      }
    : { ...INITIAL_DEVICES, status: "error", errorCode: event.result.code, latest: state.latest };
}
