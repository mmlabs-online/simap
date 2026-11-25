import type { LayoutSaveValue } from "@/lib/sprites/layout";
import type { MapView } from "@/lib/sprites/map-view";
import { SEAT_LIMITS } from "@/lib/seats/types";
import { validateLayoutSave, type FootprintLookup } from "@/lib/validate/layout";
import {
  assignCreatedSeats,
  buildSavePayload,
  dropSeat,
  forgetDeletedSeat,
  planSave,
  restoreRemovedSeat,
} from "./save-plan";
import type { Draft } from "./types";

type R<T> = { ok: true; value: T } | { ok: false; code: string };

/** The three calls a save makes; the seats API fits it structurally (lib never imports ui). */
export type SaveApi = {
  remove(seatId: string): Promise<R<null>>;
  add(roomId: string, count: number): Promise<R<{ id: string; code: string; seq: number }[]>>;
  saveLayout(roomId: string, body: LayoutSaveValue): Promise<R<MapView>>;
};

export type SaveDetail = {
  stage: "delete" | "create" | "assign" | "put";
  deleted: number;
  created: number;
  /** Code of the seat whose delete was refused. */
  seat: string | null;
  restored: "map" | "tray" | null;
};

export type SaveProgress = { draft: Draft; baseline: Draft; reset: boolean };

export type SaveOutcome =
  | { status: "saved"; view: MapView }
  | { status: "failed"; code: string; detail: SaveDetail; progress: SaveProgress | null };

export type SaveInput = {
  draft: Draft;
  baseline: Draft;
  baseVersion: number;
  roomId: string;
  footprints?: FootprintLookup;
};

/**
 * The A3 save: DELETE removed seats, POST new desks in chunks, then PUT the layout. It stops at the first
 * failure and returns what was done, so a retry only sends the remaining calls. It never throws.
 */
export async function runSave(input: SaveInput, api: SaveApi): Promise<SaveOutcome> {
  let { draft, baseline } = input;
  let stage: SaveDetail["stage"] = "delete";
  let deleted = 0;
  let created = 0;
  let seat: string | null = null;
  let restored: SaveDetail["restored"] = null;

  const fail = (code: string): SaveOutcome => ({
    status: "failed",
    code,
    detail: { stage, deleted, created, seat, restored },
    progress:
      draft === input.draft && baseline === input.baseline
        ? null
        : { draft, baseline, reset: deleted + created > 0 },
  });

  try {
    const plan = planSave(draft);
    if (!plan.ok) return fail(plan.reason);

    for (const ref of plan.deletes) {
      const r = await api.remove(ref.id);
      if (r.ok || r.code === "not_found") {
        draft = forgetDeletedSeat(draft, ref.id);
        baseline = dropSeat(baseline, ref.id);
        deleted++;
      } else {
        if (r.code === "seat_not_empty") {
          draft = restoreRemovedSeat(draft, baseline, ref.id);
          seat = ref.code;
          restored = draft.items.some((i) => i.seatId === ref.id) ? "map" : "tray";
        }
        return fail(r.code);
      }
    }

    stage = "create";
    for (let off = 0; off < plan.createKeys.length; off += SEAT_LIMITS.addMax) {
      const keys = plan.createKeys.slice(off, off + SEAT_LIMITS.addMax);
      const r = await api.add(input.roomId, keys.length);
      if (!r.ok) return fail(r.code);
      const assigned = assignCreatedSeats(draft, keys, r.value);
      if (!assigned.ok) {
        stage = "assign";
        return fail("seats_unmatched");
      }
      draft = assigned.draft;
      created += keys.length;
    }

    stage = "put";
    const built = buildSavePayload(draft, input.baseVersion);
    if (!built.ok) return fail(built.reason);
    const checked = validateLayoutSave(built.value, input.footprints);
    if (!checked.ok) return fail(checked.code);
    const saved = await api.saveLayout(input.roomId, built.value);
    return saved.ok ? { status: "saved", view: saved.value } : fail(saved.code);
  } catch {
    return fail("internal");
  }
}
