/** English strings of the Search page (D36). API error messages come from `apiErrorMessage`. */
export const searchCopy = {
  title: "Search",
  inputLabel: "Search",
  placeholder: "Search seats, devices and members",
  prompt: "Type a seat code, device, inventory number, MAC address, name or employee code.",
  groups: {
    seats: { title: "Seats", empty: "No seats match." },
    devices: { title: "Devices", empty: "No devices match." },
    members: { title: "Members", empty: "No members match." },
  },
  count: (n: number, more: boolean) => `${n}${more ? "+" : ""}`,
  loadMore: "Load more",
  loadingMore: "Loading...",
  retry: "Try again",
  emptySeat: "Empty",
  inInventory: "In inventory",
  placement: (room: string, seat: string) => `${room} / ${seat}`,
  deactivated: "Deactivated",
  mac: (m: string) => `MAC ${m}`,
} as const;
