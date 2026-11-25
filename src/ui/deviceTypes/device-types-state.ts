import { SEED_DEVICE_TYPES, type DeviceKind } from "@/lib/device-types/types";
import { SLOTS } from "@/lib/sprites/device-slots";
import { atLeastTier, type Tier } from "@/lib/tier";
import { apiErrorMessage } from "../copy/api";
import type { DeviceTypesResult } from "./device-types-api";

/** Admins open the page (the API enforces it too). */
export function canManageDeviceTypes(tier: Tier | null | undefined): boolean {
  return tier ? atLeastTier(tier, "admin") : false;
}

export type Settled = { kind: "done" } | { kind: "error"; message: string };

/** After a save: done, or the inline message. A type that is already gone counts as done (the list reloads). */
export function settleSave(result: DeviceTypesResult<unknown>): Settled {
  if (result.ok || result.code === "not_found") return { kind: "done" };
  return { kind: "error", message: apiErrorMessage(result.code) };
}

export const settleDelete = settleSave;

export type SuggestionState =
  | { status: "loading" | "error" }
  | { status: "ready"; names: readonly string[] };

const SEED_NAMES: readonly string[] = SEED_DEVICE_TYPES.map((t) => t.name);

/** Catalog names for the device Type field; the D37 seed list while loading or on error (free text stays allowed). */
export function typeSuggestions(state: SuggestionState): readonly string[] {
  return state.status === "ready" ? state.names : SEED_NAMES;
}

/** Diagram frame (SVG units, 1 unit = 1 sprite px) with a 2-tile desk; the seat is at the bottom. */
export const DIAGRAM = { w: 96, h: 64, deskX: 8, deskY: 12, tile: 40, deskH: 32 } as const;

/** Where the kind's primary slot sits on the diagram. `y` shrinks towards the back of the desk. */
export function slotMarker(kind: DeviceKind): { x: number; y: number; under: boolean } {
  const s = SLOTS[kind][0];
  return {
    x: DIAGRAM.deskX + s.u * DIAGRAM.tile + DIAGRAM.tile / 2 + s.du,
    y: DIAGRAM.deskY + DIAGRAM.deskH / 2 - s.dv,
    under: s.under,
  };
}
