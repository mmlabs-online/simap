/** English strings of the check-in room view (D36). Reused by the check-in popup and presence tickets. */
export const checkinCopy = {
  title: "Check in",
  roomHeading: (code: string, name: string) => `${code} - ${name}`,
  switcherLabel: "Room",
  whosHereTitle: "Who's here",
  whosHerePlaceholder: "Nobody is listed yet.",
  noSeatTitle: "You don't have a seat yet",
  requestSeat: "Request a seat",
  openInRoom: "Open in room details",
  retry: "Try again",
  loading: "Loading",
} as const;
