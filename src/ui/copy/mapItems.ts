import type { MapItemKind } from "@/lib/map-items/types";

/** English strings of the Map items page (D36). API error messages come from `apiErrorMessage`. */
export const mapItemsCopy = {
  noAccess: "Only admins can manage map items.",
  intro: "These items fill the Add items palette in the room editor. Items are never deleted.",
  list: {
    empty: "The map item catalog is not ready yet. Try again in a moment.",
    hidden: "Hidden",
    fixed: "Fixed size",
  },
  edit: "Edit",
  editLabel: (name: string) => `Edit map item ${name}`,
  form: {
    title: "Edit map item",
    key: "Library key",
    name: "Name",
    group: "Group",
    shown: "Show in the Add items palette",
    hideHint: "Hiding only removes it from the Add items palette; placed copies stay on the map.",
    chairNote:
      "The chair only sets the art of the chair drawn at each seat. It is never in the palette.",
    size: "Size (tiles)",
    width: "Width",
    height: "Height",
    inUseHint: "A size change is refused while the item is placed in any room.",
    rotationHint: "Size at rotation 0; east and west swap width and height.",
    fixedReason: {
      seat: "Fixed by the seat footprint and device slots",
      floor: "Floor tiles are always 1 × 1",
      chair: "The chair size is fixed",
      fixture: "This size is fixed",
    } satisfies Record<MapItemKind, string>,
    resizeWarning: (images: number, sprites: number) => {
      const parts = [
        images > 0 ? `${images} custom ${images === 1 ? "image" : "images"} will be deleted` : "",
        sprites > 0
          ? `${sprites} package ${sprites === 1 ? "sprite" : "sprites"} that no longer fit will be cleared`
          : "",
      ].filter(Boolean);
      return `Changing the size: ${parts.join(" and ")}.`;
    },
    confirmResize: "I understand, change the size",
    confirmFirst: "Confirm the size change first.",
    reset: "Reset to library defaults…",
  },
  fieldErrors: {
    name: "Enter a name of 1 to 60 characters.",
    group: "Enter a group of 1 to 40 characters.",
    w: "Width must be from 1 to 4.",
    h: "Height must be from 1 to 4.",
    hidden: "Choose whether to show the item.",
    body: "Nothing to save.",
  } as Record<string, string>,
  errors: {
    inUse: (rooms: number) =>
      rooms === 1
        ? "This item is placed in 1 room. Remove it from that room before changing its size."
        : `This item is placed in ${rooms} rooms. Remove it from every room before changing its size.`,
  },
  reset: {
    title: "Reset to library defaults",
    confirm: "Reset item",
    intro: (name: string) => `Reset ${name} to its library defaults? This sets:`,
    name: (v: string) => `Name: ${v}`,
    group: (v: string) => `Group: ${v}`,
    size: (v: string) => `Size: ${v}`,
    shown: "Shown in the Add items palette",
    images: (n: number) => `${n} custom ${n === 1 ? "image" : "images"} will be deleted.`,
    sprites: "Package sprites are cleared.",
    inUseNote: "The size changes, so this is refused while the item is placed in any room.",
  },
} as const;
