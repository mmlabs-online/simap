export const DEVICE_LIMITS = {
  list: 1000,
  name: 120,
  type: 60,
  inventoryNumber: 60,
  serial: 100,
  manufacturer: 100,
  brand: 100,
  note: 500,
} as const;

export type DeviceCreateValue = {
  name: string;
  type: string;
  inventoryNumber: string;
  mac: string | null;
  serial: string | null;
  manufacturer: string | null;
  brand: string | null;
};

export type DevicePatchValue = Partial<{
  name: string;
  type: string;
  inventoryNumber: string;
  mac: string | null;
  serial: string | null;
  manufacturer: string | null;
  brand: string | null;
}>;

/** DEV-07: assign an org-inventory device to a member. `expiresOn` is `YYYY-MM-DD` (UTC+7 calendar day) or null. */
export type AssignValue = { memberId: string; note: string | null; expiresOn: string | null };

export type HoldingPatchValue = Partial<{ note: string | null; expiresOn: string | null }>;

export type DeviceRole = "primary" | "secondary";

export type PlacementFilter = "all" | "placed" | "inventory" | "unowned" | "overdue";

export type DevicePlacementDto = {
  seatId: string;
  seatCode: string;
  roomId: string;
  roomCode: string;
  role: DeviceRole;
};

export type DeviceDto = {
  id: string;
  name: string;
  type: string;
  inventoryNumber: string;
  mac: string | null;
  serial: string | null;
  manufacturer: string | null;
  brand: string | null;
  /** Null exactly when the device is unowned (org inventory). */
  holding: { note: string | null; expiresOn: string | null } | null;
  /** Null when the device is in the org inventory (D63). */
  owner: { id: string; displayName: string } | null;
  /** Null when the device is in inventory. */
  placement: DevicePlacementDto | null;
  /** True when the caller owns the device (computed on the server from the token's sub). */
  mine: boolean;
  /** Owner or Admin (D19); an unowned device is edited by an Admin only. */
  canEdit: boolean;
  /** Owner or Manager+ (D19); false for an unowned device (invariant 5). */
  canPlace: boolean;
  /** Admin, the device is in the org inventory and has no pending handoff (DEV-01). */
  canDelete: boolean;
  /** Manager+, the device is in the org inventory and has no pending handoff (DEV-07). */
  canAssign: boolean;
  /** Manager+ and the device is owned: edits the note and expiry (DEV-07). */
  canEditHolding: boolean;
  /** Owned, no pending handoff, and the caller is the owner or a Manager+ (DEV-08). */
  canTransfer: boolean;
  /** Owned, no pending handoff, and the caller is the owner or a Manager+ (DEV-09). */
  canReturn: boolean;
  /** Admin, owned, and no pending return; a pending transfer is cancelled by take-back (DEV-09). */
  canTakeBack: boolean;
  /** Owned and the expiry day is before today (UTC+7); computed on read, never stored (DEV-10). */
  overdue: boolean;
  /** The one pending handoff, visible to whoever may read the device (DEV-02); the note is not included. */
  pendingHandoff: PendingHandoffDto | null;
};

export type HandoffKind = "transfer" | "return" | "extension";
export type HandoffStatus = "pending" | "confirmed" | "declined" | "cancelled";

/** DEV-08 / DEV-09 start body. `extension` is the owner's request for a new expiry (DEV-10). */
export type HandoffStartValue =
  | { kind: "transfer"; toMemberId: string; note: string | null }
  | { kind: "return"; note: string | null }
  | { kind: "extension"; newExpiresOn: string; note: string | null };

export type HandoffBox = "incoming" | "returns" | "extensions";

export type MemberRef = { id: string; displayName: string };

export type HandoffDto = {
  id: string;
  kind: HandoffKind;
  status: HandoffStatus;
  device: {
    id: string;
    name: string;
    type: string;
    inventoryNumber: string;
    expiresOn: string | null;
  };
  from: MemberRef;
  to: MemberRef | null;
  requestedBy: MemberRef;
  decidedBy: MemberRef | null;
  note: string | null;
  newExpiresOn: string | null;
  createdAt: string;
  decidedAt: string | null;
  /** For the caller; all three are false unless the handoff is pending. */
  canCancel: boolean;
  canConfirm: boolean;
  canDecline: boolean;
};

export type PendingHandoffDto = {
  id: string;
  kind: HandoffKind;
  to: MemberRef | null;
  requestedBy: MemberRef;
  /** Set for kind extension. */
  newExpiresOn: string | null;
  createdAt: string;
  canCancel: boolean;
};

export type HandoffListResponse = { items: HandoffDto[]; truncated: boolean };
export type HandoffCountDto = {
  incoming: number;
  returns: number;
  /** Pending extension requests; 0 below Manager. */
  extensions: number;
  /** The caller's own owned devices past expiry. */
  overdue: number;
};

export type DeviceListResponse = { items: DeviceDto[]; truncated: boolean };

/** DEV-12: one page of the caller's held devices. */
export type MyDevicesPage = { items: DeviceDto[]; nextCursor: string | null };

export type DeviceHistoryKind =
  | "create"
  | "assign"
  | "holding_update"
  | "transfer_start"
  | "transfer_cancel"
  | "transfer_decline"
  | "transfer_confirm"
  | "return_start"
  | "return_cancel"
  | "return_confirm"
  | "return_take_back"
  | "extension_start"
  | "extension_cancel"
  | "extension_decline"
  | "extension_confirm";

export const DEVICE_HISTORY_KINDS: readonly DeviceHistoryKind[] = [
  "create",
  "assign",
  "holding_update",
  "transfer_start",
  "transfer_cancel",
  "transfer_decline",
  "transfer_confirm",
  "return_start",
  "return_cancel",
  "return_confirm",
  "return_take_back",
  "extension_start",
  "extension_cancel",
  "extension_decline",
  "extension_confirm",
];

/** The audit actions read as device history: `device.<kind>`. Exact match; `device.return` is a placement move, not a return. */
export const DEVICE_HISTORY_ACTIONS: readonly string[] = DEVICE_HISTORY_KINDS.map(
  (k) => `device.${k}`,
);

export const DEVICE_HISTORY_LIMITS = { defaultLimit: 50, maxLimit: 100 } as const;

export const MY_DEVICES_LIMITS = { defaultLimit: 50, maxLimit: 100 } as const;

export type DeviceHistoryEntryDto = {
  /** audit_log.id */
  id: string;
  kind: DeviceHistoryKind;
  /** UTC instant with microseconds: YYYY-MM-DDTHH:MM:SS.ffffffZ */
  at: string;
  /** Null when there is no member row for the audit actor. */
  actor: MemberRef | null;
  /** Null = org inventory, or no member row. */
  from: MemberRef | null;
  /** Null = org inventory, or no member row. */
  to: MemberRef | null;
  note: string | null;
  /** YYYY-MM-DD */
  expiresOn: string | null;
  /** YYYY-MM-DD, the date before an expiry change. */
  fromExpiresOn: string | null;
  /** The actor of a confirm or an Admin take-back. */
  confirmedBy: MemberRef | null;
  /** Why a cancel or decline happened, from the audit meta flags. */
  cause: "manager" | "take_back" | "deactivation" | null;
};

export type DeviceHistoryPage = {
  items: DeviceHistoryEntryDto[];
  nextCursor: string | null;
  /** UTC instant of the latest assign or transfer confirm; null when the device is unowned. */
  holderSince: string | null;
};
