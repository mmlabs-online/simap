import { LAYOUT_LIMITS } from "@/lib/validate/layout";
import { SPRITE_KEY_RE } from "@/lib/validate/map-item";
import { DEVICE_KINDS } from "@/lib/device-types/types";
import type { DeviceKind } from "./device-slots";
import { parsePixelLook } from "./pixel-look";
import type {
  LayoutItem,
  Placement,
  RoomLayout,
  SeatDevice,
  SeatDeviceType,
  SeatState,
  SeatView,
} from "./layout";

/** The room map's view data, mapped from `GET /api/rooms/{id}/layout`. */
export type MapView = {
  layout: RoomLayout;
  /** One entry per placed seat id. */
  seatViews: Record<string, SeatView>;
  /** Devices per placed seat, in draw order. */
  seatDevices: Record<string, SeatDevice[]>;
  /** The catalog rows the layout references (hidden ones included), for sizes and names. */
  items: LayoutItem[];
  /** Seats without a placement, in server order. */
  unplaced: { id: string; code: string }[];
  truncated: boolean;
  saved: boolean;
  /** The layout version the save must send as `baseVersion`. */
  version: number;
  /** True when there is nothing to draw: no seats, fixtures or floors. */
  empty: boolean;
};

export type MapLoadState = {
  status: "loading" | "ready" | "error";
  view: MapView | null;
  errorCode: string | null;
};

const STATES: readonly SeatState[] = ["empty", "occupied", "mine", "pending", "cannot"];
const ROTATIONS: readonly unknown[] = [0, 90, 180, 270];

const isObject = (b: unknown): b is Record<string, unknown> => typeof b === "object" && b !== null;
const isInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);
const isStr = (s: unknown): s is string => typeof s === "string";

const validPlacement = (p: unknown): p is Placement =>
  isObject(p) && isStr(p.sprite) && isInt(p.x) && isInt(p.y) && ROTATIONS.includes(p.rotation);

const validSeat = (s: unknown) =>
  validPlacement(s) && isStr(s.id) && isStr((s as { code?: unknown }).code);

const validFloor = (f: unknown) =>
  isObject(f) && isStr(f.sprite) && isInt(f.x) && isInt(f.y) && isInt(f.w) && isInt(f.h);

const KINDS: readonly unknown[] = ["seat", "fixture", "floor", "chair"];

const validItem = (i: unknown): i is LayoutItem =>
  isObject(i) &&
  isStr(i.builtinKey) &&
  isStr(i.name) &&
  isStr(i.group) &&
  isInt(i.w) &&
  isInt(i.h) &&
  KINDS.includes(i.kind) &&
  typeof i.directional === "boolean" &&
  typeof i.fixedSize === "boolean" &&
  isObject(i.art);

const emptyView = (): SeatView => ({ state: "empty", avatarSeed: null, name: null, look: null });

function toDeviceType(raw: unknown): SeatDeviceType | null {
  if (!isObject(raw) || !isStr(raw.id) || !isStr(raw.slot)) return null;
  if (!DEVICE_KINDS.includes(raw.slot as DeviceKind)) return null;
  if (typeof raw.hasImage !== "boolean" || !isInt(raw.imageVersion)) return null;
  return {
    id: raw.id,
    slot: raw.slot as DeviceKind,
    hasImage: raw.hasImage,
    imageVersion: raw.imageVersion,
    sprite: typeof raw.sprite === "string" && SPRITE_KEY_RE.test(raw.sprite) ? raw.sprite : null,
  };
}

function toSeatDevices(raw: unknown): SeatDevice[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .flatMap((d): SeatDevice[] => {
      if (!isObject(d) || (d.type !== null && !isStr(d.type))) return [];
      return "deviceType" in d && d.deviceType !== undefined
        ? [{ type: d.type, deviceType: toDeviceType(d.deviceType) }]
        : [{ type: d.type }];
    })
    .slice(0, LAYOUT_LIMITS.devicesPerSeat);
}

function toSeatView(raw: unknown): SeatView {
  if (!isObject(raw) || !STATES.includes(raw.state as SeatState)) return emptyView();
  return {
    state: raw.state as SeatState,
    avatarSeed: isStr(raw.avatarSeed) ? raw.avatarSeed : null,
    name: isStr(raw.name) ? raw.name : null,
    look: parsePixelLook(raw.look),
  };
}

/** Checks the payload shape (the layout rules are the job of the server) and maps it; null for a bad shape. */
export function toMapView(body: unknown): MapView | null {
  if (!isObject(body) || !isObject(body.layout)) return null;
  const l = body.layout;
  if (
    !isInt(l.w) ||
    !isInt(l.h) ||
    !Array.isArray(l.seats) ||
    !Array.isArray(l.fixtures) ||
    !Array.isArray(l.floors) ||
    !Array.isArray(body.unplaced) ||
    typeof body.truncated !== "boolean" ||
    !isInt(body.version) ||
    body.version < 0
  ) {
    return null;
  }
  if (!l.seats.every(validSeat) || !l.fixtures.every(validPlacement)) return null;
  if (!l.floors.every(validFloor)) return null;
  if (!body.unplaced.every((u) => isObject(u) && isStr(u.id) && isStr(u.code))) return null;

  const layout = l as unknown as RoomLayout;
  const views = isObject(body.seatViews) ? body.seatViews : {};
  const seatViews: Record<string, SeatView> = {};
  for (const seat of layout.seats) seatViews[seat.id] = toSeatView(views[seat.id]);
  const devices = isObject(body.seatDevices) ? body.seatDevices : {};
  const seatDevices: Record<string, SeatDevice[]> = {};
  for (const seat of layout.seats) {
    const list = toSeatDevices(devices[seat.id]);
    if (list.length > 0) seatDevices[seat.id] = list;
  }
  return {
    layout,
    seatViews,
    seatDevices,
    items: Array.isArray(body.items) ? body.items.filter(validItem) : [],
    unplaced: (body.unplaced as { id: string; code: string }[]).map((u) => ({
      id: u.id,
      code: u.code,
    })),
    truncated: body.truncated,
    saved: body.saved === true,
    version: body.version,
    empty: layout.seats.length === 0 && layout.fixtures.length === 0 && layout.floors.length === 0,
  };
}
