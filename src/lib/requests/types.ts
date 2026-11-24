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
