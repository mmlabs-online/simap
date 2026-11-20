import { API_ERROR_CODES, type ApiErrorCode } from "@/lib/api/error";

/** English messages for the API error codes of `/api/*` (D36). Typecheck forces a text for every new code. */
export const apiCopy = {
  errors: {
    unauthenticated: "Your session has ended. Sign in again.",
    org_required: "No organization selected yet",
    forbidden: "You don't have permission",
    member_deactivated:
      "Your access to this organization is turned off. Ask an organization admin.",
    unavailable: "The service is not available right now. Try again in a moment.",
    internal: "Something went wrong. Try again in a moment.",
    invalid_request: "Some of the information is not valid. Check it and try again.",
    not_found: "This item was not found.",
    room_code_taken: "This room code is already used.",
    room_not_empty: "This room still has seats or people.",
  } satisfies Record<ApiErrorCode, string>,
} as const;

/** The message for an API error code; an unknown code reads as a generic failure. */
export function apiErrorMessage(code: string): string {
  return (API_ERROR_CODES as readonly string[]).includes(code)
    ? apiCopy.errors[code as ApiErrorCode]
    : apiCopy.errors.internal;
}
