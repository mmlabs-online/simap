/** Zoom levels of the room map: whole numbers only (spec LAY "Visual style"). */
export const ZOOM_LEVELS = [2, 3, 4] as const;
export type Zoom = (typeof ZOOM_LEVELS)[number];

export type Rotation = 0 | 90 | 180 | 270;

export type Placement = { id: string; sprite: string; x: number; y: number; rotation: Rotation };

export type FloorZone = { sprite: string; x: number; y: number; w: number; h: number };

/** Provisional: SIM-015.1 owns the persisted shape. Derived seat status lives in `SeatView`, never here. */
export type RoomLayout = {
  w: number;
  h: number;
  floors: FloorZone[];
  seats: (Placement & { code: string })[];
  fixtures: Placement[];
};

export type SeatState = "empty" | "occupied" | "mine" | "pending" | "cannot";

export type SeatView = { state: SeatState; avatarSeed: string | null; name: string | null };
