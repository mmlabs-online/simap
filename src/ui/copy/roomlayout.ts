/** English strings of the room map (D36). Seat codes and names come from data and are not translated here. */
export const roomlayoutCopy = {
  loading: "Loading the room map...",
  error: "The room map could not be loaded. Reload the page to try again.",
  regionLabel: "Room map",
  heading: "Room map",
  panHint: "Scroll or swipe to pan. Select a seat to open its details.",
  retry: "Try again",
  tooLarge: "This room is too large to draw as a map. Use the seat table below.",
  zoomLimited: "Larger zoom levels are off for this room because the map would be too big.",
  emptyMap: "This room has no layout yet.",
  unplacedNote: (n: number) =>
    n === 1
      ? "1 seat is not placed on the map. Find it in the seat table below."
      : `${n} seats are not placed on the map. Find them in the seat table below.`,
  truncated: (n: number) => `The map shows only the first ${n} seats.`,
  seatStates: {
    empty: "empty",
    occupied: "occupied",
    mine: "your seat",
    pending: "request pending",
    cannot: "cannot seat",
  },
  seatLabel: (code: string, state: string, name: string | null) =>
    name ? `Seat ${code}, ${state}, ${name}` : `Seat ${code}, ${state}`,
  zoomLabel: "Zoom",
  zoomOption: (z: number) => `${z}x`,
} as const;
