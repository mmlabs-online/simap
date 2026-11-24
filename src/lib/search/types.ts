import type { DevicePlacementDto } from "@/lib/devices/types";
import type { MemberStatus } from "@/lib/members/types";

export const SEARCH_LIMITS = { q: 80, defaultLimit: 20, maxLimit: 50 } as const;
export type SearchKind = "seat" | "device" | "member";

export type SeatHit = {
  id: string;
  code: string;
  roomId: string;
  roomCode: string;
  occupant: { id: string; displayName: string } | null;
};
export type DeviceHit = {
  id: string;
  name: string;
  inventoryNumber: string;
  mac: string | null;
  owner: { id: string; displayName: string };
  placement: DevicePlacementDto | null;
};
export type MemberHit = {
  id: string;
  displayName: string;
  employeeCode: string | null;
  status: MemberStatus;
};
export type SearchGroup<T> = { items: T[]; nextCursor: string | null };
/** Groups not requested by `kind` are null. */
export type SearchResponse = {
  seats: SearchGroup<SeatHit> | null;
  devices: SearchGroup<DeviceHit> | null;
  members: SearchGroup<MemberHit> | null;
};
