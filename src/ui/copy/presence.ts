import { apiErrorMessage } from "./api";

/** English strings of "Who's here" and the presence view (D36). Names and seat codes come from data. */
export const presenceCopy = {
  empty: "Nobody is checked in to this room yet.",
  loading: "Loading who is here",
  error: "Who is here could not be loaded.",
  retry: "Try again",
  stale: "Could not refresh. The list may be out of date.",
  notOnMap: "Not on the map",
  unnamed: "Unnamed",
  source: { self: "Self", provider: "Third-party" },
  focusLabel: (name: string, code: string) => `Show ${name} at seat ${code} on the map`,
  /** The move refusal shown under the map. `seat_not_yours` would read as the device message in the API copy. */
  moveError: (code: string) =>
    code === "seat_not_yours"
      ? "You can only move to a seat that is yours in this room."
      : apiErrorMessage(code),
} as const;
