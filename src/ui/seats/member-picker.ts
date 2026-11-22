import { MEMBER_LIMITS } from "@/lib/members/types";

export const PICKER_PAGE = 20;

export type PickerMember = { id: string; displayName: string; employeeCode: string | null };
export type PickerPage = { items: PickerMember[]; nextCursor: string | null };
export type PickerResult = { ok: true; value: PickerPage } | { ok: false; code: string };
export type LoadPage = (q: string, cursor: string | null) => Promise<PickerResult>;

export type PickerState = {
  items: PickerMember[];
  nextCursor: string | null;
  status: "loading" | "ready" | "error";
  errorCode: string | null;
  /** Request id of the load-more in flight, else null. */
  moreId: number | null;
  moreFailed: boolean;
  /** Request id of the newest search. */
  latest: number;
  selectedId: string | null;
};

export type PickerEvent =
  | { type: "search"; id: number }
  | { type: "more"; id: number }
  | { type: "loaded"; id: number; result: PickerResult }
  | { type: "select"; memberId: string };

export const INITIAL_PICKER: PickerState = {
  items: [],
  nextCursor: null,
  status: "loading",
  errorCode: null,
  moreId: null,
  moreFailed: false,
  latest: 0,
  selectedId: null,
};

/** Same cleaning as the server's `parseMemberQuery`, then at most 80 code points. */
export function normalizePickerQuery(raw: string): string {
  const clean = raw.normalize("NFC").replace(/\s+/gu, " ").trim();
  return [...clean].slice(0, MEMBER_LIMITS.q).join("").trim();
}

export function pickerReducer(state: PickerState, event: PickerEvent): PickerState {
  switch (event.type) {
    case "search":
      return { ...INITIAL_PICKER, latest: event.id };
    case "more":
      return { ...state, moreId: event.id, moreFailed: false };
    case "select":
      return { ...state, selectedId: event.memberId };
    case "loaded": {
      const { id, result } = event;
      if (id === state.moreId) {
        if (!result.ok) return { ...state, moreId: null, moreFailed: true };
        const seen = new Set(state.items.map((m) => m.id));
        const added = result.value.items.filter((m) => !seen.has(m.id));
        return {
          ...state,
          items: [...state.items, ...added],
          nextCursor: result.value.nextCursor,
          moreId: null,
        };
      }
      if (id !== state.latest || state.moreId !== null) return state;
      return result.ok
        ? {
            ...state,
            items: result.value.items,
            nextCursor: result.value.nextCursor,
            status: "ready",
            errorCode: null,
          }
        : { ...state, status: "error", errorCode: result.code };
    }
  }
}

export function canLoadMore(state: PickerState): boolean {
  return state.nextCursor !== null && state.status === "ready" && state.moreId === null;
}

/** The chosen member, only if still listed and not the current occupant. */
export function selectedMember(state: PickerState, occupantId: string | null): PickerMember | null {
  if (state.selectedId === null || state.selectedId === occupantId) return null;
  return state.items.find((m) => m.id === state.selectedId) ?? null;
}

/** Enter in the search box must not submit the form; Enter that confirms an IME composition is left alone. */
export function blocksSearchEnter(key: string, isComposing: boolean): boolean {
  return key === "Enter" && !isComposing;
}
