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
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export type ApiErrorBody = { error: { code: ApiErrorCode } };
