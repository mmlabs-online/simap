/** English strings of the Dashboard page (D36). API error messages come from `apiErrorMessage`. */
export const dashboardCopy = {
  retry: "Try again",
  percent: (p: number) => `${p}%`,
  tiles: {
    rooms: "Rooms",
    seats: "Seats",
    occupied: "Occupied seats",
    rate: "Occupancy rate",
    devicesPlaced: "Devices placed",
    devicesInventory: "Devices in inventory",
  },
  roomsHeading: "Rooms",
  noRooms: "No rooms yet.",
  roomsTruncated: (shown: number, total: number) => `Showing ${shown} of ${total} rooms.`,
  holders: {
    title: (n: number) =>
      `${n} deactivated ${n === 1 ? "member still holds" : "members still hold"} seats`,
    hint: "Release their seats from the seat detail in the room.",
    seatCount: (n: number) => `${n} ${n === 1 ? "seat" : "seats"}`,
    moreSeats: (n: number) => `+${n} more`,
    moreMembers: (n: number) => `+${n} more ${n === 1 ? "member" : "members"}`,
  },
} as const;
