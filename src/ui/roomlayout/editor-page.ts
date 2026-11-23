import type { MapLoadState } from "@/lib/sprites/map-view";
import type { Tier } from "@/lib/tier";
import { canManageSeats } from "../seats/seat-actions";
import type { RoomResolution } from "../seats/seat-view";

export type EditorGate =
  | "checking"
  | "not_allowed"
  | "desktop"
  | "loading"
  | "missing"
  | "error"
  | "read_only"
  | "ready";

type Input = {
  tier: Tier | null | undefined;
  /** Null until the media query has been read. */
  isDesktop: boolean | null;
  /** Null until the data hooks are mounted (they only mount for an admin on a wide screen). */
  resolution: RoomResolution | null;
  load: MapLoadState | null;
};

/** What the editor page shows. A non-admin is decided before any room or layout is fetched. */
export function editorGate({ tier, isDesktop, resolution, load }: Input): EditorGate {
  if (tier == null) return "checking";
  if (!canManageSeats(tier)) return "not_allowed";
  if (isDesktop === null) return "checking";
  if (!isDesktop) return "desktop";
  if (resolution === null || resolution.kind === "loading") return "loading";
  if (resolution.kind === "error") return "error";
  if (resolution.kind === "missing") return "missing";
  if (load === null) return "loading";
  if (load.view !== null) return load.view.truncated ? "read_only" : "ready";
  return load.status === "error" ? "error" : "loading";
}
