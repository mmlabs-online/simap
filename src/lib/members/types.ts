export type MemberStatus = "active" | "deactivated";

export type MeMemberDto = {
  id: string;
  displayName: string;
  status: MemberStatus;
  /** True until the member saves a display name (first-visit screen). */
  needsProfile: boolean;
};

export const MEMBER_LIMITS = {
  defaultLimit: 50,
  maxLimit: 100,
  q: 80,
  employeeCode: 32,
  listRefs: 20,
  detailRefs: 500,
  invitations: 100,
  groups: 500,
} as const;

export type MemberStatusFilter = "active" | "deactivated" | "all";

export type MemberSeatRef = { id: string; code: string };

export type MemberDeviceRef = {
  id: string;
  name: string;
  inventoryNumber: string;
  role: "primary" | "secondary";
  seatId: string | null;
  seatCode: string | null;
};

export type MemberGroupRef = { id: string; name: string; color: string };

export type MemberDto = {
  id: string;
  displayName: string;
  email: string;
  employeeCode: string | null;
  group: MemberGroupRef | null;
  status: MemberStatus;
  seatCount: number;
  /** null: hidden from a User for another member (MEM-02, D69); `devices` is then []. */
  deviceCount: number | null;
  seats: MemberSeatRef[];
  devices: MemberDeviceRef[];
};

export type MemberListResponse = {
  items: MemberDto[];
  nextCursor: string | null;
  groups: MemberGroupRef[];
};

export type PendingInvitationDto = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string | null;
};

export type DeactivationImpact = {
  occupiedSeats: number;
  placedDevices: number;
  primaryDevicesToDemote: number;
  pendingRequests: number;
};
