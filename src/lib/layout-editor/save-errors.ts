export type SaveErrorKind = "conflict" | "access" | "gone" | "invalid" | "retry";

const ACCESS = ["unauthenticated", "forbidden", "member_deactivated", "org_required"];
const INVALID = [
  "layout_out_of_bounds",
  "layout_overlap",
  "layout_bad_rotation",
  "layout_unknown_sprite",
  "layout_fixture_on_desk",
  "layout_too_many_seats",
  "invalid_request",
  "seat_not_empty",
];

/** How the editor reacts to a failed save. Unknown codes read as retryable. */
export function saveErrorKind(code: string): SaveErrorKind {
  if (code === "layout_stale" || code === "layout_seats_changed" || code === "seats_unmatched") {
    return "conflict";
  }
  if (ACCESS.includes(code)) return "access";
  if (code === "not_found") return "gone";
  if (INVALID.includes(code)) return "invalid";
  return "retry";
}
