/** English strings of the room map (D36). Seat codes and names come from data and are not translated here. */
export const roomlayoutCopy = {
  loading: "Loading the room map...",
  error: "The room map could not be loaded. Reload the page to try again.",
  regionLabel: "Room map",
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
