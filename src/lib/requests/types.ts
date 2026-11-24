import type { AuditCursor } from "@/lib/audit/cursor";

export const REQUEST_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export type RequestDto = {
  id: string;
  status: RequestStatus;
  seat: { id: string; code: string; roomId: string; roomCode: string };
  subject: { id: string; displayName: string };
  createdAt: string;
  decidedAt: string | null;
  decidedBy: { id: string; displayName: string } | null;
};

export type RequestCreateResult = { created: boolean; request: RequestDto };

export const REQUEST_LIMITS = { defaultLimit: 50, maxLimit: 100 } as const;

export type RequestListFilter = { status: RequestStatus; limit: number; cursor?: AuditCursor };
export type MyRequestsFilter = { limit: number; cursor?: AuditCursor };

export type RequestListItemDto = RequestDto & {
  currentOccupant: { id: string; displayName: string } | null;
};
export type RequestPage = { items: RequestListItemDto[]; nextCursor: string | null };

export type MyRequestDto = RequestDto & { isNew: boolean };
export type MyRequestsPage = { items: MyRequestDto[]; unseen: number; nextCursor: string | null };

export type RequestsSeenResult = { unseen: number; requestsSeenAt: string | null };
