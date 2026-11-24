import type { LayoutSaveValue } from "@/lib/sprites/layout";
import { placeFromTray } from "./draft";
import type { Draft, EditorItem, SeatRef } from "./types";

const isNewDesk = (i: EditorItem) => i.kind === "seat" && i.seatId === null;

/** Comparable form: items sorted by key and without it, tray and removed as ids. */
function normalised(d: Draft): string {
  const items = [...d.items]
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map(({ key: _key, ...rest }) => rest);
  return JSON.stringify({
    w: d.w,
    h: d.h,
    floors: d.floors,
    items,
    tray: d.tray.map((t) => t.id),
    removed: d.removed.map((r) => r.id),
  });
}

export const isDirty = (baseline: Draft, draft: Draft): boolean =>
  normalised(baseline) !== normalised(draft);

export type SavePlan =
  | { ok: true; deletes: SeatRef[]; createKeys: string[] }
  | { ok: false; reason: "unplaced" };

/** Save order: delete removed seats, create new desks (in add order), then PUT. */
export function planSave(draft: Draft): SavePlan {
  if (draft.tray.length > 0) return { ok: false, reason: "unplaced" };
  return {
    ok: true,
    deletes: draft.removed,
    createKeys: draft.items.filter(isNewDesk).map((i) => i.key),
  };
}

/** Map created seats, by ascending `seq`, onto the new desks in add order. */
export function assignCreatedSeats(
  draft: Draft,
  createKeys: readonly string[],
  created: readonly { id: string; code: string; seq: number }[],
): { ok: true; draft: Draft } | { ok: false; reason: "count_mismatch" } {
  if (created.length !== createKeys.length) return { ok: false, reason: "count_mismatch" };
  const sorted = [...created].sort((a, b) => a.seq - b.seq);
  const byKey = new Map(createKeys.map((k, n) => [k, sorted[n]]));
  return {
    ok: true,
    draft: {
      ...draft,
      items: draft.items.map((i) => {
        const seat = byKey.get(i.key);
        return seat ? { ...i, key: `s:${seat.id}`, seatId: seat.id, code: seat.code } : i;
      }),
    },
  };
}

/** The PUT body. Refused while a desk has no seat id or a seat is still in the tray. */
export function buildSavePayload(
  draft: Draft,
  baseVersion: number,
): { ok: true; value: LayoutSaveValue } | { ok: false; reason: "unplaced" | "missing_seat_id" } {
  if (draft.tray.length > 0) return { ok: false, reason: "unplaced" };
  const seats: LayoutSaveValue["seats"] = [];
  for (const i of draft.items) {
    if (i.kind !== "seat") continue;
    if (i.seatId === null) return { ok: false, reason: "missing_seat_id" };
    seats.push({ id: i.seatId, sprite: i.sprite, x: i.x, y: i.y, rotation: i.rotation });
  }
  return {
    ok: true,
    value: {
      baseVersion,
      w: draft.w,
      h: draft.h,
      floors: draft.floors.map((z) => ({ sprite: z.sprite, x: z.x, y: z.y, w: z.w, h: z.h })),
      seats,
      fixtures: draft.items
        .filter((i) => i.kind === "fixture")
        .map((i) => ({ sprite: i.sprite, x: i.x, y: i.y, rotation: i.rotation })),
    },
  };
}

/** A DELETE succeeded: the seat no longer needs deleting. */
export const forgetDeletedSeat = (draft: Draft, id: string): Draft => ({
  ...draft,
  removed: draft.removed.filter((r) => r.id !== id),
});

/** A DELETE was refused: put the seat back at its baseline place if the rules allow, else into the tray. */
export function restoreRemovedSeat(draft: Draft, baseline: Draft, id: string): Draft {
  const ref = draft.removed.find((r) => r.id === id);
  if (!ref) return draft;
  const trayed: Draft = {
    ...draft,
    removed: draft.removed.filter((r) => r.id !== id),
    tray: [...draft.tray, ref],
  };
  const at = baseline.items.find((i) => i.seatId === id);
  if (!at) return trayed;
  const placed = placeFromTray(trayed, id, at.x, at.y, at.rotation);
  return placed.ok ? placed.draft : trayed;
}

/** Dry-run ids for new desks (`n:<k>`), so the PUT rules can be checked before any seat exists. Never sent. */
export function withPlaceholderSeatIds(draft: Draft): Draft {
  return {
    ...draft,
    items: draft.items.map((i) => {
      if (!isNewDesk(i)) return i;
      const k = Number(i.key.slice(2));
      return { ...i, seatId: `00000000-0000-4000-8000-${k.toString(16).padStart(12, "0")}` };
    }),
  };
}

/** A seat the server deleted is gone from the baseline too (items and tray). */
export const dropSeat = (draft: Draft, id: string): Draft => ({
  ...draft,
  items: draft.items.filter((i) => i.seatId !== id),
  tray: draft.tray.filter((t) => t.id !== id),
});
