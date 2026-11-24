/** English strings of the Devices page (D36). API error messages come from `apiErrorMessage`. */
export const devicesCopy = {
  retry: "Try again",
  filterLabel: "Show devices",
  filters: { all: "All", placed: "Placed", inventory: "Inventory" },
  columns: {
    name: "Name",
    type: "Type",
    inventoryNumber: "Inventory no.",
    mac: "MAC",
    owner: "Owner",
    placement: "Placement",
  },
  caption: "Devices and where they are",
  noMac: "—",
  you: "You",
  atSeat: (seatCode: string) => `At seat ${seatCode}`,
  inInventory: "In inventory",
  roles: { primary: "Primary", secondary: "Secondary" },
  empty: {
    placed: "No devices are placed at a seat.",
    inventory: "No devices in inventory.",
  },
  showAll: "Show all devices",
  summary: (n: number, label: string) => `${n} ${n === 1 ? "device" : "devices"} · ${label}`,
  typeLine: (type: string, inventoryNumber: string) => `${type} · ${inventoryNumber}`,
  truncated: (n: number) => `Showing the first ${n} devices.`,
};
