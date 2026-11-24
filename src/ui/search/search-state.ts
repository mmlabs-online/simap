import { roomDetailHref } from "@/lib/nav";
import { foldText } from "@/lib/search/fold";
import {
  SEARCH_LIMITS,
  type DeviceHit,
  type MemberHit,
  type SearchGroup,
  type SearchKind,
  type SeatHit,
} from "@/lib/search/types";
import { seatHref } from "../seats/seat-view";

export type GroupKey = "seats" | "devices" | "members";
export const GROUP_ORDER: readonly GroupKey[] = ["seats", "devices", "members"];
export const GROUP_KIND: Record<GroupKey, SearchKind> = {
  seats: "seat",
  devices: "device",
  members: "member",
};
export const DEVICES_HREF = "/devices";
export const MEMBERS_HREF = "/members";

export type AllGroups = {
  seats: SearchGroup<SeatHit>;
  devices: SearchGroup<DeviceHit>;
  members: SearchGroup<MemberHit>;
};
export type SearchResult<T> = { ok: true; value: T } | { ok: false; code: string };

export type GroupState<T> = {
  items: T[];
  nextCursor: string | null;
  /** Request id of the load-more in flight, else null. */
  moreId: number | null;
  moreError: string | null;
};

export type SearchState = {
  query: string;
  status: "idle" | "loading" | "ready" | "error";
  errorCode: string | null;
  /** Request id of the newest search. */
  latest: number;
  seats: GroupState<SeatHit>;
  devices: GroupState<DeviceHit>;
  members: GroupState<MemberHit>;
};

export type SearchEvent =
  | { type: "search"; id: number; q: string }
  | { type: "loaded"; id: number; result: SearchResult<AllGroups> }
  | { type: "more"; group: GroupKey; id: number }
  | {
      type: "moreLoaded";
      group: GroupKey;
      id: number;
      result: SearchResult<SearchGroup<SeatHit | DeviceHit | MemberHit>>;
    };

const emptyGroup = <T>(): GroupState<T> => ({
  items: [],
  nextCursor: null,
  moreId: null,
  moreError: null,
});

export const INITIAL_SEARCH: SearchState = {
  query: "",
  status: "idle",
  errorCode: null,
  latest: 0,
  seats: emptyGroup(),
  devices: emptyGroup(),
  members: emptyGroup(),
};

const fresh = <T>(g: SearchGroup<T>): GroupState<T> => ({
  items: g.items,
  nextCursor: g.nextCursor,
  moreId: null,
  moreError: null,
});

export function searchReducer(state: SearchState, event: SearchEvent): SearchState {
  switch (event.type) {
    case "search":
      return {
        ...INITIAL_SEARCH,
        query: event.q,
        latest: event.id,
        status: event.q === "" ? "idle" : "loading",
      };
    case "loaded": {
      if (event.id !== state.latest || state.status !== "loading") return state;
      const { result } = event;
      if (!result.ok) return { ...state, status: "error", errorCode: result.code };
      return {
        ...state,
        status: "ready",
        errorCode: null,
        seats: fresh(result.value.seats),
        devices: fresh(result.value.devices),
        members: fresh(result.value.members),
      };
    }
    case "more":
      return {
        ...state,
        [event.group]: { ...state[event.group], moreId: event.id, moreError: null },
      };
    case "moreLoaded": {
      const current = state[event.group];
      if (event.id !== current.moreId) return state;
      const { result } = event;
      if (!result.ok) {
        return { ...state, [event.group]: { ...current, moreId: null, moreError: result.code } };
      }
      const seen = new Set(current.items.map((i) => i.id));
      const added = result.value.items.filter((i) => !seen.has(i.id));
      return {
        ...state,
        [event.group]: {
          ...current,
          items: [...current.items, ...added],
          nextCursor: result.value.nextCursor,
          moreId: null,
          moreError: null,
        },
      };
    }
  }
}

export function canLoadMore(state: SearchState, group: GroupKey): boolean {
  const g = state[group];
  return state.status === "ready" && g.nextCursor !== null && g.moreId === null;
}

/** Same cleaning as the server's `parseSearchQuery`, then at most 80 code points. */
export function normalizeSearchQuery(raw: string): string {
  const clean = raw.normalize("NFC").replace(/\s+/gu, " ").trim();
  return [...clean].slice(0, SEARCH_LIMITS.q).join("").trim();
}

/** False for a query the server would refuse (blank, or only marks that fold away). */
export function isSearchable(q: string): boolean {
  return q !== "" && foldText(q) !== "";
}

/** Reads `searchParams.getAll("q")`: exactly one value, else "". */
export function parseSearchParam(values: string[]): string {
  return values.length === 1 ? normalizeSearchQuery(values[0]) : "";
}

export function searchHref(q: string): string {
  return q === "" ? "/search" : `/search?q=${encodeURIComponent(q)}`;
}

/** The seat's room page with `?seat=`, or null for a room code a browser would collapse. */
export function seatResultHref(hit: Pick<SeatHit, "roomCode" | "code">): string | null {
  const room = roomDetailHref(hit.roomCode);
  return room === null ? null : seatHref(room, hit.code);
}
