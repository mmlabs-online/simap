import {
  LAYOUT_LIMITS,
  checkLayoutRules,
  floorCellsWithinCap,
  footprintOf,
} from "@/lib/validate/layout";
import { defaultLayout } from "./default-layout";
import type { FloorZone, LayoutResponse, Placement, Rotation } from "./layout";
import { ROTATION_TO_DIR, chairFor, resolveFrameKey } from "./placement";
import { REGISTRY } from "./registry";

export type StoredPlacement = { sprite: string; x: number; y: number; rotation: number };
export type StoredSeat = { id: string; code: string; placement: StoredPlacement | null };
export type StoredFixture = StoredPlacement & { id: string };
export type StoredRoom = { gridW: number | null; gridH: number | null; floorZones: unknown };

const ZONE_KEYS = ["sprite", "x", "y", "w", "h"];

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v);

/** Stored floors are untrusted: all-or-nothing, any problem gives the single default floor. */
export function parseStoredFloors(raw: unknown, w: number, h: number): FloorZone[] {
  const fallback: FloorZone[] = [{ sprite: "floor.wood", x: 0, y: 0, w, h }];
  if (!Array.isArray(raw) || raw.length > LAYOUT_LIMITS.floors) return fallback;
  const out: FloorZone[] = [];
  for (const z of raw as unknown[]) {
    if (typeof z !== "object" || z === null || Array.isArray(z)) return fallback;
    const o = z as Record<string, unknown>;
    if (
      Object.keys(o).length !== ZONE_KEYS.length ||
      !ZONE_KEYS.every((k) => Object.hasOwn(o, k))
    ) {
      return fallback;
    }
    if (typeof o.sprite !== "string" || !isInt(o.x) || !isInt(o.y) || !isInt(o.w) || !isInt(o.h)) {
      return fallback;
    }
    const zone: FloorZone = { sprite: o.sprite, x: o.x, y: o.y, w: o.w, h: o.h };
    if (!checkLayoutRules({ w, h, floors: [zone], seats: [], fixtures: [] }).ok) return fallback;
    out.push(zone);
  }
  return floorCellsWithinCap(out, w, h) ? out : fallback;
}

/**
 * A room's layout from stored rows, which are untrusted. Never throws and never yields a layout that
 * `checkLayoutRules` refuses. Seats stay reachable: a seat that cannot keep its place takes the first
 * free pitch slot, else it is listed in `unplaced`.
 */
export function resolveLayout(
  room: StoredRoom,
  seatRows: readonly StoredSeat[],
  fixtureRows: readonly StoredFixture[],
): Pick<LayoutResponse, "saved" | "layout" | "unplaced"> {
  const seats = seatRows.slice(0, LAYOUT_LIMITS.seats);
  const fixtures = fixtureRows.slice(0, LAYOUT_LIMITS.fixtures);
  const { gridW: w, gridH: h } = room;
  if (
    w === null ||
    h === null ||
    !checkLayoutRules({ w, h, floors: [], seats: [], fixtures: [] }).ok
  ) {
    return { saved: false, layout: defaultLayout(seats), unplaced: [] };
  }

  // Cells held by blocking footprints and chair tiles; a non-blocking item conflicts with nothing.
  const occupied = new Set<number>();
  const take = (kind: "seat" | "fixture", p: StoredPlacement): boolean => {
    const one = [{ sprite: p.sprite, x: p.x, y: p.y, rotation: p.rotation }];
    const rules = kind === "seat" ? { seats: one, fixtures: [] } : { seats: [], fixtures: one };
    if (!checkLayoutRules({ w, h, floors: [], ...rules }).ok) return false;
    const rot = p.rotation as Rotation;
    const key = resolveFrameKey(p.sprite, rot);
    const fp = footprintOf(p.sprite, rot);
    if (key === null || fp === null) return false;
    const cells: number[] = [];
    if (REGISTRY[key].blocks) {
      for (let dy = 0; dy < fp[1]; dy++) {
        for (let dx = 0; dx < fp[0]; dx++) cells.push((p.y + dy) * w + p.x + dx);
      }
    }
    if (kind === "seat") {
      const c = chairFor(p, fp, REGISTRY[key].dir ?? ROTATION_TO_DIR[rot]);
      cells.push(c.y * w + c.x);
    }
    if (cells.some((c) => occupied.has(c))) return false;
    for (const c of cells) occupied.add(c);
    return true;
  };

  const placed = new Map<string, Placement & { code: string }>();
  const waiting: StoredSeat[] = [];
  for (const s of seats) {
    if (s.placement !== null && take("seat", s.placement)) {
      const { sprite, x, y, rotation } = s.placement;
      placed.set(s.id, { id: s.id, code: s.code, sprite, x, y, rotation: rotation as Rotation });
    } else {
      waiting.push(s);
    }
  }

  const outFixtures: Placement[] = [];
  for (const f of fixtures) {
    if (take("fixture", f)) {
      outFixtures.push({
        id: f.id,
        sprite: f.sprite,
        x: f.x,
        y: f.y,
        rotation: f.rotation as Rotation,
      });
    }
  }

  // One cursor: a rejected slot stays rejected because `occupied` only grows.
  let sx = 0;
  let sy = 0;
  const unplaced: { id: string; code: string }[] = [];
  for (const s of waiting) {
    let found = false;
    while (!found && sy + 2 <= h) {
      if (sx + 2 > w) {
        sx = 0;
        sy += 2;
        continue;
      }
      if (take("seat", { sprite: "desk.single", x: sx, y: sy, rotation: 0 })) {
        placed.set(s.id, {
          id: s.id,
          code: s.code,
          sprite: "desk.single",
          x: sx,
          y: sy,
          rotation: 0,
        });
        found = true;
      }
      sx += 3;
    }
    if (!found) unplaced.push({ id: s.id, code: s.code });
  }

  return {
    saved: true,
    layout: {
      w,
      h,
      floors: parseStoredFloors(room.floorZones, w, h),
      seats: seats.flatMap((s) => placed.get(s.id) ?? []),
      fixtures: outFixtures,
    },
    unplaced,
  };
}
