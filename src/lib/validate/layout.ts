import type { ApiErrorCode } from "@/lib/api/error";
import { SEAT_LIMITS } from "@/lib/seats/types";
import type { FloorZone, LayoutSaveValue, Placement, Rotation } from "@/lib/sprites/layout";
import { ROTATION_TO_DIR, chairFor, resolveFrameKey } from "@/lib/sprites/placement";
import { REGISTRY } from "@/lib/sprites/registry";
import { isCanonicalUuid } from "./uuid";

export const LAYOUT_LIMITS = {
  grid: 64,
  seats: SEAT_LIMITS.list,
  fixtures: 2000,
  floors: 64,
  floorCells: 2,
  bodyBytes: 262_144,
  maxVersion: 2_147_483_647,
} as const;

export type LayoutRuleCode = Extract<
  ApiErrorCode,
  "layout_out_of_bounds" | "layout_overlap" | "layout_bad_rotation" | "layout_unknown_sprite"
>;

/** 400 `invalid_request` carries the offending field; the 422 codes carry none. */
export type LayoutFailure =
  | { ok: false; code: "invalid_request"; field: string }
  | { ok: false; code: LayoutRuleCode };

type RulesItem = { sprite: string; x: number; y: number; rotation: number };

/** What the rules need: no ids and no codes, so a `RoomLayout` and a `LayoutSaveValue` both fit. */
export type LayoutRulesInput = {
  w: number;
  h: number;
  floors: readonly FloorZone[];
  seats: readonly RulesItem[];
  fixtures: readonly RulesItem[];
};

const ROTATIONS: readonly number[] = [0, 90, 180, 270];
export const SEAT_SPRITES: readonly string[] = ["desk.single"];
export const FIXTURE_GROUPS: readonly string[] = [
  "cabinet",
  "circulation",
  "door",
  "label",
  "lamp",
  "marker",
  "partition",
  "plant",
  "prop",
  "rack",
  "shelf",
  "sofa",
  "table",
  "wall",
  "whiteboard",
  "window",
];

type SpriteInfo = { group: string; directional: boolean };

/** Base keys only: a directional sprite is stored without its `.n/.e/.s/.w` suffix (A3). */
const SPRITES: ReadonlyMap<string, SpriteInfo> = (() => {
  const map = new Map<string, SpriteInfo>();
  for (const [key, entry] of Object.entries(REGISTRY)) {
    if (entry.dir === null) map.set(key, { group: entry.group, directional: false });
  }
  for (const [key, entry] of Object.entries(REGISTRY)) {
    if (entry.dir !== null) map.set(key.slice(0, -2), { group: entry.group, directional: true });
  }
  return map;
})();

/** Group and directional flag of a base sprite key, or null when the registry has none. */
export function spriteInfo(sprite: string): SpriteInfo | null {
  return SPRITES.get(sprite) ?? null;
}

/** Footprint in tiles for a base key at a rotation, read from the registry (never swapped here). */
export function footprintOf(sprite: string, rotation: Rotation): [number, number] | null {
  const key = resolveFrameKey(sprite, rotation);
  if (key === null) return null;
  return REGISTRY[key].tiles ?? [1, 1];
}

const fail = (code: LayoutRuleCode): LayoutFailure => ({ ok: false, code });
const bad = (field: string): LayoutFailure => ({ ok: false, code: "invalid_request", field });

type Kind = "seat" | "fixture" | "floor";

function spriteOk(kind: Kind, sprite: string): boolean {
  const info = SPRITES.get(sprite);
  if (!info) return false;
  if (kind === "seat") return SEAT_SPRITES.includes(sprite);
  if (kind === "floor") return info.group === "floor" && !info.directional;
  return FIXTURE_GROUPS.includes(info.group);
}

const inGrid = (x: number, y: number, w: number, h: number, gw: number, gh: number) =>
  x >= 0 && y >= 0 && w >= 1 && h >= 1 && x + w <= gw && y + h <= gh;

/** First failure in a fixed order: grid, sprite, rotation, bounds (items, zones, chairs), overlap. */
export function checkLayoutRules(layout: LayoutRulesInput): { ok: true } | LayoutFailure {
  const { grid } = LAYOUT_LIMITS;
  if (!Number.isSafeInteger(layout.w) || layout.w < 1 || layout.w > grid) {
    return fail("layout_out_of_bounds");
  }
  if (!Number.isSafeInteger(layout.h) || layout.h < 1 || layout.h > grid) {
    return fail("layout_out_of_bounds");
  }

  const groups: [Kind, readonly { sprite: string }[]][] = [
    ["floor", layout.floors],
    ["seat", layout.seats],
    ["fixture", layout.fixtures],
  ];
  for (const [kind, list] of groups) {
    for (const item of list) if (!spriteOk(kind, item.sprite)) return fail("layout_unknown_sprite");
  }

  for (const item of [...layout.seats, ...layout.fixtures]) {
    if (!ROTATIONS.includes(item.rotation)) return fail("layout_bad_rotation");
    if (item.rotation !== 0 && !SPRITES.get(item.sprite)?.directional) {
      return fail("layout_bad_rotation");
    }
  }

  type Placed = { x: number; y: number; w: number; d: number; blocks: boolean };
  const placed: Placed[] = [];
  const chairs: { x: number; y: number }[] = [];
  for (const [kind, list] of [
    ["seat", layout.seats],
    ["fixture", layout.fixtures],
  ] as const) {
    for (const item of list) {
      const key = resolveFrameKey(item.sprite, item.rotation as Rotation);
      const fp = footprintOf(item.sprite, item.rotation as Rotation);
      if (key === null || fp === null) return fail("layout_unknown_sprite");
      if (!inGrid(item.x, item.y, fp[0], fp[1], layout.w, layout.h)) {
        return fail("layout_out_of_bounds");
      }
      placed.push({ x: item.x, y: item.y, w: fp[0], d: fp[1], blocks: REGISTRY[key].blocks });
      if (kind === "seat") {
        const dir = REGISTRY[key].dir ?? ROTATION_TO_DIR[item.rotation as Rotation];
        chairs.push(chairFor(item, fp, dir));
      }
    }
  }
  for (const z of layout.floors) {
    if (!inGrid(z.x, z.y, z.w, z.h, layout.w, layout.h)) return fail("layout_out_of_bounds");
  }
  for (const c of chairs) {
    if (!inGrid(c.x, c.y, 1, 1, layout.w, layout.h)) return fail("layout_out_of_bounds");
  }

  const taken = new Set<number>();
  for (const p of placed) {
    if (!p.blocks) continue;
    for (let dy = 0; dy < p.d; dy++) {
      for (let dx = 0; dx < p.w; dx++) {
        const cell = (p.y + dy) * layout.w + p.x + dx;
        if (taken.has(cell)) return fail("layout_overlap");
        taken.add(cell);
      }
    }
  }
  const chairCells = new Set<number>();
  for (const c of chairs) {
    const cell = c.y * layout.w + c.x;
    if (taken.has(cell) || chairCells.has(cell)) return fail("layout_overlap");
    chairCells.add(cell);
  }
  return { ok: true };
}

/** Total floor cells (overlaps counted) within `floorCells` times the grid area. Zones must be in bounds already. */
export function floorCellsWithinCap(floors: readonly FloorZone[], w: number, h: number): boolean {
  let total = 0;
  for (const z of floors) total += z.w * z.h;
  return total <= w * h * LAYOUT_LIMITS.floorCells;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const hasExactKeys = (o: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(o).length === keys.length && keys.every((k) => Object.hasOwn(o, k));

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v);

/** Shape (400), then the layout rules (422). Pure: the caller maps the failure to a response. */
export function validateLayoutSave(
  body: unknown,
): { ok: true; value: LayoutSaveValue } | LayoutFailure {
  if (
    !isPlainObject(body) ||
    !hasExactKeys(body, ["baseVersion", "w", "h", "floors", "seats", "fixtures"])
  ) {
    return bad("body");
  }
  if (
    !isInt(body.baseVersion) ||
    body.baseVersion < 0 ||
    body.baseVersion > LAYOUT_LIMITS.maxVersion
  ) {
    return bad("baseVersion");
  }
  if (!isInt(body.w)) return bad("w");
  if (!isInt(body.h)) return bad("h");
  const { floors, seats, fixtures } = body;
  if (!Array.isArray(floors) || floors.length > LAYOUT_LIMITS.floors) return bad("floors");
  if (!Array.isArray(seats) || seats.length > LAYOUT_LIMITS.seats) return bad("seats");
  if (!Array.isArray(fixtures) || fixtures.length > LAYOUT_LIMITS.fixtures) return bad("fixtures");

  const outFloors: FloorZone[] = [];
  for (const z of floors) {
    if (!isPlainObject(z) || !hasExactKeys(z, ["sprite", "x", "y", "w", "h"])) return bad("floors");
    if (typeof z.sprite !== "string" || !isInt(z.x) || !isInt(z.y) || !isInt(z.w) || !isInt(z.h)) {
      return bad("floors");
    }
    outFloors.push({ sprite: z.sprite, x: z.x, y: z.y, w: z.w, h: z.h });
  }

  const outSeats: Placement[] = [];
  const seen = new Set<string>();
  for (const s of seats) {
    if (!isPlainObject(s) || !hasExactKeys(s, ["id", "sprite", "x", "y", "rotation"])) {
      return bad("seats");
    }
    if (!isCanonicalUuid(s.id) || seen.has(s.id)) return bad("seats");
    seen.add(s.id);
    if (typeof s.sprite !== "string" || !isInt(s.x) || !isInt(s.y) || !isInt(s.rotation)) {
      return bad("seats");
    }
    outSeats.push({ id: s.id, sprite: s.sprite, x: s.x, y: s.y, rotation: s.rotation as Rotation });
  }

  const outFixtures: Omit<Placement, "id">[] = [];
  for (const f of fixtures) {
    if (!isPlainObject(f) || !hasExactKeys(f, ["sprite", "x", "y", "rotation"])) {
      return bad("fixtures");
    }
    if (typeof f.sprite !== "string" || !isInt(f.x) || !isInt(f.y) || !isInt(f.rotation)) {
      return bad("fixtures");
    }
    outFixtures.push({ sprite: f.sprite, x: f.x, y: f.y, rotation: f.rotation as Rotation });
  }

  const value: LayoutSaveValue = {
    baseVersion: body.baseVersion,
    w: body.w,
    h: body.h,
    floors: outFloors,
    seats: outSeats,
    fixtures: outFixtures,
  };
  const rules = checkLayoutRules(value);
  if (!rules.ok) return rules;
  if (!floorCellsWithinCap(value.floors, value.w, value.h)) return bad("floors");
  return { ok: true, value };
}
