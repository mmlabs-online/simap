import type { MapItemDto } from "@/lib/map-items/types";
import type { DeviceKind } from "./device-slots";

/** Zoom levels of the room map: whole numbers only (spec LAY "Visual style"). */
export const ZOOM_LEVELS = [1, 2, 3, 4] as const;
export type Zoom = (typeof ZOOM_LEVELS)[number];

export type Rotation = 0 | 90 | 180 | 270;

export type Placement = { id: string; sprite: string; x: number; y: number; rotation: Rotation };

export type FloorZone = { sprite: string; x: number; y: number; w: number; h: number };

/** A room's tile layout; `w`/`h` are in tiles. Derived seat status lives in `SeatView`, never here. */
export type RoomLayout = {
  w: number;
  h: number;
  floors: FloorZone[];
  seats: (Placement & { code: string })[];
  fixtures: Placement[];
};

/** A validated layout save (SIM-015.1 API contract): the seats are exactly the room's, fixtures carry no id. */
export type LayoutSaveValue = {
  baseVersion: number;
  w: number;
  h: number;
  floors: FloorZone[];
  seats: Placement[];
  fixtures: Omit<Placement, "id">[];
};

export type SeatState = "empty" | "occupied" | "mine" | "pending" | "cannot";

export type SeatView = { state: SeatState; avatarSeed: string | null; name: string | null };

/** The catalog type a seat device resolves to (D61): its slot and image version, never the type name. */
export type SeatDeviceType = {
  id: string;
  slot: DeviceKind;
  hasImage: boolean;
  imageVersion: number;
};

/** A device placed at a seat; only its type is public on the map. `deviceType` is null when the type is not in the org catalog. */
export type SeatDevice = { type: string; deviceType?: SeatDeviceType | null };

/** A catalog item the layout uses, hidden ones included; the hidden flag is never sent here (D67 2). */
export type LayoutItem = Omit<MapItemDto, "hidden">;

/** GET /api/rooms/{id}/layout (SIM-015.1 contract): one room's layout with derived seat status. */
export type LayoutResponse = {
  room: { id: string; code: string; name: string };
  version: number;
  saved: boolean;
  layout: RoomLayout;
  seatViews: Record<string, SeatView>;
  /** Per seat with devices. Array order is draw order (primary first, then created_at, id): do not re-sort. At most LAYOUT_LIMITS.devicesPerSeat. */
  seatDevices: Record<string, SeatDevice[]>;
  unplaced: { id: string; code: string }[];
  truncated: boolean;
  /** Catalog rows of the keys the layout uses (SIM-039.3), sorted by builtinKey. */
  items: LayoutItem[];
};
