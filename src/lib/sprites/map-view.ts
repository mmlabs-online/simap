import type { Placement, RoomLayout, SeatState, SeatView } from "./layout";

/** The room map's view data, mapped from `GET /api/rooms/{id}/layout`. */
export type MapView = {
  layout: RoomLayout;
  /** One entry per placed seat id. */
  seatViews: Record<string, SeatView>;
  /** Seats without a placement, in server order. */
  unplaced: { id: string; code: string }[];
  truncated: boolean;
  saved: boolean;
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

const emptyView = (): SeatView => ({ state: "empty", avatarSeed: null, name: null });

function toSeatView(raw: unknown): SeatView {
  if (!isObject(raw) || !STATES.includes(raw.state as SeatState)) return emptyView();
  return {
    state: raw.state as SeatState,
    avatarSeed: isStr(raw.avatarSeed) ? raw.avatarSeed : null,
    name: isStr(raw.name) ? raw.name : null,
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
    typeof body.truncated !== "boolean"
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
  return {
    layout,
    seatViews,
    unplaced: (body.unplaced as { id: string; code: string }[]).map((u) => ({
      id: u.id,
      code: u.code,
    })),
    truncated: body.truncated,
    saved: body.saved === true,
    empty: layout.seats.length === 0 && layout.fixtures.length === 0 && layout.floors.length === 0,
  };
}
