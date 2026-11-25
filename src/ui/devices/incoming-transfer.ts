import type { HandoffBox, HandoffCountDto, HandoffDto, PlacementFilter } from "@/lib/devices/types";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import type { DevicesResult } from "./devices-api";
import { NOTHING_CHANGED } from "./transfer-device";

const copy = devicesCopy.incoming;

export type IncomingResult = DevicesResult<HandoffDto>;
export type IncomingCall = () => Promise<IncomingResult>;

export type IncomingOutcome = {
  refresh: boolean;
  notice: { tone: "status" | "error"; text: string };
};

const STALE = ["handoff_not_pending", "handoff_stale", "not_found"];

/** The outcome of a failed confirm, decline or cancel; shared with the return flow. */
export function handoffActionFailed(code: string): IncomingOutcome {
  if (STALE.includes(code)) {
    return { refresh: true, notice: { tone: "status", text: devicesCopy.transfer.gone } };
  }
  return {
    refresh: !NOTHING_CHANGED.includes(code),
    notice: { tone: "error", text: apiErrorMessage(code) },
  };
}

/** What the page does after Confirm, from the result only. A recipient-owned, unplaced device hides under Placed and Org inventory. */
export function confirmOutcome(
  result: DevicesResult<HandoffDto>,
  item: Pick<HandoffDto, "device">,
  filter: PlacementFilter,
): IncomingOutcome {
  if (!result.ok) return handoffActionFailed(result.code);
  const base = copy.confirmed(item.device.name, item.device.inventoryNumber);
  const hint = filter === "placed" || filter === "unowned" ? ` ${copy.filterHint}` : "";
  return { refresh: true, notice: { tone: "status", text: base + hint } };
}

/** What the page does after Decline, from the result only. */
export function declineOutcome(
  result: DevicesResult<HandoffDto>,
  item: Pick<HandoffDto, "device">,
): IncomingOutcome {
  if (!result.ok) return handoffActionFailed(result.code);
  return {
    refresh: true,
    notice: { tone: "status", text: copy.declined(item.device.name, item.device.inventoryNumber) },
  };
}

export type FocusTarget =
  | { kind: "confirm"; id: string }
  | { kind: "section"; list: HandoffBox }
  | { kind: "page" };

/** After an item leaves: the next item's Confirm, else the section heading, else the page heading. */
export function focusAfter(
  before: HandoffDto[],
  removedId: string,
  after: HandoffDto[],
  list: HandoffBox,
): FocusTarget {
  const at = before.findIndex((h) => h.id === removedId);
  const next = at < 0 ? undefined : before[at + 1];
  if (next) {
    const still = after.find((h) => h.id === next.id);
    if (still?.canConfirm) return { kind: "confirm", id: still.id };
  }
  return after.length > 0 ? { kind: "section", list } : { kind: "page" };
}

/** The count result wins; a failed count falls back to the refreshed list lengths; a failed list keeps the badge. */
export function badgeCountAfter(
  count: DevicesResult<HandoffCountDto>,
  incoming: HandoffDto[] | null,
  returns: HandoffDto[] | null,
): HandoffCountDto | null {
  if (count.ok) return count.value;
  return incoming === null || returns === null
    ? null
    : { incoming: incoming.length, returns: returns.length, extensions: 0, overdue: 0 };
}

/** Incoming transfers, pending returns and the caller's overdue devices; `extensions` joins with the Manager list. */
export const badgeTotal = (c: HandoffCountDto): number => c.incoming + c.returns + c.overdue;

/** The lists the caller may fetch. `box=returns` is Admin only, so a non-Admin never asks for it (it answers 422). */
export const handoffBoxes = (isAdmin: boolean): HandoffBox[] =>
  isAdmin ? ["incoming", "returns"] : ["incoming"];

export type IncomingState = {
  status: "loading" | "error" | "ready";
  items: HandoffDto[];
  truncated: boolean;
  errorCode: string | null;
  latest: number;
};

export const INITIAL_INCOMING: IncomingState = {
  status: "loading",
  items: [],
  truncated: false,
  errorCode: null,
  latest: 0,
};

export type IncomingEvent =
  | { type: "load"; id: number }
  | { type: "refresh"; id: number }
  | {
      type: "loaded";
      id: number;
      result: DevicesResult<{ items: HandoffDto[]; truncated: boolean }>;
    };

/** A load clears the items, a refresh keeps them; a failed refresh keeps the items and sets the error; an answer for an older request is ignored. */
export function incomingReducer(state: IncomingState, event: IncomingEvent): IncomingState {
  if (event.type === "load") return { ...INITIAL_INCOMING, latest: event.id };
  if (event.type === "refresh") return { ...state, latest: event.id };
  if (event.id !== state.latest) return state;
  if (event.result.ok) {
    return {
      status: "ready",
      items: event.result.value.items,
      truncated: event.result.value.truncated,
      errorCode: null,
      latest: state.latest,
    };
  }
  return { ...state, status: "error", errorCode: event.result.code };
}
