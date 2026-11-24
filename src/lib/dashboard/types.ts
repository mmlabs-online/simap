import type { RoomDto } from "@/lib/rooms/types";

export const DASHBOARD_LIMITS = { holders: 50, holderSeats: 10 } as const;

export type DashboardTotals = {
  rooms: number;
  /** Every seat, including cannot-seat seats (same as the room cards). */
  seats: number;
  /** Seats with an occupant. */
  occupied: number;
  /** Devices with a seat (primary and secondary). */
  devicesPlaced: number;
  /** Devices without a seat. */
  devicesInventory: number;
};

export type HolderSeatRef = { id: string; code: string; roomId: string; roomCode: string };

export type DeactivatedHolderDto = {
  member: { id: string; displayName: string };
  /** True count of seats held. */
  seatCount: number;
  /** First `DASHBOARD_LIMITS.holderSeats` seats, ordered by code, id. */
  seats: HolderSeatRef[];
};

export type DashboardDto = {
  totals: DashboardTotals;
  rooms: RoomDto[];
  /** `totals.rooms > rooms.length`. */
  roomsTruncated: boolean;
  /** Manager+ only; null below. `total` = true number of deactivated members holding at least one seat. */
  deactivatedHolders: { total: number; items: DeactivatedHolderDto[] } | null;
};
