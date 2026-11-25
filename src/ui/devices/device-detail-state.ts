import type { DeviceDto, DeviceHistoryEntryDto, DeviceHistoryPage } from "@/lib/devices/types";
import type { DevicesResult } from "./devices-api";

export type DetailState = {
  status: "loading" | "error" | "notFound" | "ready";
  device: DeviceDto | null;
  errorCode: string | null;
  latest: number;
};

export const INITIAL_DETAIL: DetailState = {
  status: "loading",
  device: null,
  errorCode: null,
  latest: 0,
};

export type DetailEvent =
  | { type: "load"; id: number }
  | { type: "loaded"; id: number; result: DevicesResult<DeviceDto> };

/** An answer for an older request is ignored. A 404 is its own state, any other failure is an error with a Retry. */
export function detailReducer(state: DetailState, event: DetailEvent): DetailState {
  if (event.type === "load") return { ...INITIAL_DETAIL, latest: event.id };
  if (event.id !== state.latest) return state;
  if (event.result.ok) {
    return { status: "ready", device: event.result.value, errorCode: null, latest: state.latest };
  }
  const status = event.result.code === "not_found" ? "notFound" : "error";
  return { status, device: null, errorCode: event.result.code, latest: state.latest };
}

export type HistoryState = {
  status: "loading" | "error" | "ready";
  items: DeviceHistoryEntryDto[];
  nextCursor: string | null;
  holderSince: string | null;
  errorCode: string | null;
  loadingMore: boolean;
  moreError: boolean;
  latest: number;
};

export const INITIAL_HISTORY: HistoryState = {
  status: "loading",
  items: [],
  nextCursor: null,
  holderSince: null,
  errorCode: null,
  loadingMore: false,
  moreError: false,
  latest: 0,
};

export type HistoryEvent =
  | { type: "load"; id: number }
  | { type: "loaded"; id: number; result: DevicesResult<DeviceHistoryPage> }
  | { type: "loadMore"; id: number }
  | { type: "moreLoaded"; id: number; result: DevicesResult<DeviceHistoryPage> };

/** `load` resets (first page or Retry); `loadMore` appends. Any answer that is not for the latest request is dropped. */
export function historyReducer(state: HistoryState, event: HistoryEvent): HistoryState {
  if (event.type === "load") return { ...INITIAL_HISTORY, latest: event.id };
  if (event.type === "loadMore") {
    return { ...state, loadingMore: true, moreError: false, latest: event.id };
  }
  if (event.id !== state.latest) return state;
  if (event.type === "loaded") {
    return event.result.ok
      ? {
          ...INITIAL_HISTORY,
          status: "ready",
          items: event.result.value.items,
          nextCursor: event.result.value.nextCursor,
          holderSince: event.result.value.holderSince,
          latest: state.latest,
        }
      : { ...INITIAL_HISTORY, status: "error", errorCode: event.result.code, latest: state.latest };
  }
  if (!event.result.ok) return { ...state, loadingMore: false, moreError: true };
  return {
    ...state,
    items: [...state.items, ...event.result.value.items],
    nextCursor: event.result.value.nextCursor,
    holderSince: event.result.value.holderSince,
    loadingMore: false,
    moreError: false,
  };
}
