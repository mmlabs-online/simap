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
    employee_code_taken: "This employee code is already used.",
    member_not_empty: "This member still has seats or devices.",
    cannot_deactivate_self: "You can't deactivate yourself.",
    role_not_allowed: "You can't invite someone with this role.",
    seat_not_empty: "This seat still has an occupant or devices. Clear them first.",
    seat_cannot_seat: "This seat is marked as not available for seating.",
    occupant_changed: "This seat just changed. Check it and try again.",
    not_allowed: "This action is not allowed.",
    member_not_assignable: "This member can't be assigned. They may have been deactivated.",
    layout_out_of_bounds: "Something in this layout is outside the room.",
    layout_overlap: "Two items in this layout are on the same tile.",
    layout_bad_rotation: "An item in this layout has a rotation it can't use.",
    layout_unknown_sprite: "This layout uses an item that doesn't exist.",
    layout_fixture_on_desk: "An item sits on a desk. Desk tops are kept for the seat's devices.",
    layout_stale: "This room changed while you were editing. Reload to see the latest layout.",
    layout_seats_changed: "The room's seats changed while you were editing. Reload and try again.",
    layout_too_many_seats: "This room has too many seats to save a layout.",
    seat_taken: "Someone already sits in this seat.",
    no_linked_member:
      "Your member profile in this organization isn't set up yet. Open simap's home page to finish it.",
    placement_changed: "This device was moved by someone else. Refresh and try again.",
    seat_has_no_occupant: "Only a seat with an occupant can have a primary device.",
    owner_not_occupant: "A primary device must belong to the person at the seat.",
    seat_has_primary: "This seat already has a primary device.",
    device_placed: "This device is at a seat. Move it to inventory before deleting it.",
    device_unowned: "A device in the org inventory can't be placed at a seat.",
    device_owned: "This device has an owner, so it is no longer in the org inventory.",
    handoff_pending: "This device has a pending handoff. Resolve it before deleting the device.",
    inventory_number_taken: "Another device already has this inventory number.",
    mac_taken: "Another device already has this MAC address.",
    serial_taken: "Another device already has this serial number.",
    not_assigned: "This device is not assigned to anyone any more. Refresh and try again.",
    group_name_taken: "Another group already has this name.",
    project_code_taken: "Another project already has this code.",
    in_use: "This is still used by seats or members. Confirm to remove it from them.",
    invalid_group: "That group no longer exists. Reload and try again.",
    invalid_project: "That project no longer exists. Reload and try again.",
    name_taken: "Another device type already has this name.",
    type_limit: "This organization has reached the limit of 100 device types.",
    image_not_png: "This file is not a valid PNG image.",
    image_bad_size: "The image must be exactly 24 x 24 pixels.",
    image_too_large: "The image is too large. The limit is 20 KB.",
    image_changed: "This image was changed by someone else. Reload and try again.",
    images_unavailable: "Images are not available right now. Try again in a moment.",
    drive_error: "The image could not be loaded or saved. Try again later.",
  } satisfies Record<ApiErrorCode, string>,
} as const;

/** The message for an API error code; an unknown code reads as a generic failure. */
export function apiErrorMessage(code: string): string {
  return (API_ERROR_CODES as readonly string[]).includes(code)
    ? apiCopy.errors[code as ApiErrorCode]
    : apiCopy.errors.internal;
}
