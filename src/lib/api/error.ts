export const API_ERROR_CODES = [
  "unauthenticated",
  "org_required",
  "forbidden",
  "member_deactivated",
  "unavailable",
  "internal",
  "invalid_request",
  "not_found",
  "room_code_taken",
  "room_not_empty",
  "employee_code_taken",
  "member_not_empty",
  "cannot_deactivate_self",
  "role_not_allowed",
  "seat_not_empty",
  "seat_cannot_seat",
  "occupant_changed",
  "not_allowed",
  "member_not_assignable",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export type ApiErrorBody = { error: { code: ApiErrorCode } };
