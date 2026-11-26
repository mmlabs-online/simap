/** English strings of the check-in popup and the floating Check in / Check out button (D36, PRE-01/02). */
export const checkinPopupCopy = {
  title: "Check in",
  intro: "Pick the room you are working in today, or just look around.",
  seatRoomsLegend: "Your rooms",
  lockedHeading: "No seat in these rooms",
  locked: "Locked",
  selected: "Selected",
  yourSeat: (code: string) => `Your seat: ${code}`,
  count: (n: number | null) =>
    n === null ? "Count unavailable" : n === 0 ? "Nobody here yet" : `${n} here now`,
  lastCheckin: (when: string | null) => `Last check-in: ${when ?? "never"}`,
  checkInTo: (code: string) => `Check in to ${code}`,
  justLook: "Just look",
  button: { checkIn: "Check in", checkOut: "Check out", retry: "Try again" },
} as const;
