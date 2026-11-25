import type { MapItemKind } from "@/lib/map-items/types";

/** English strings of the Map items page (D36). API error messages come from `apiErrorMessage`. */
export const mapItemsCopy = {
  noAccess: "Only admins can manage map items.",
  intro: "These items fill the Add items palette in the room editor. Items are never deleted.",
  list: {
    empty: "The map item catalog is not ready yet. Try again in a moment.",
    hidden: "Hidden",
    fixed: "Fixed size",
    customised: "Customised",
  },
  edit: "Edit",
  artLabel: (name: string) => `Edit art of map item ${name}`,
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
  art: {
    button: "Art",
    title: (name: string) => `Art for ${name}`,
    hint: "Each direction needs its own art; images are never rotated.",
    close: "Close",
    single: "Art",
    sameForAll: "Same for every rotation",
    dirs: { n: "North", e: "East", s: "South", w: "West" } as Record<string, string>,
    source: {
      image: "Custom image",
      sprite: (key: string) => `Package sprite: ${key}`,
      library: "Library sprite",
      hidden: (key: string) => `Package sprite ${key} is set but hidden by the custom image.`,
    },
    size: (w: number, hMin: number, hMax: number) =>
      hMin === hMax
        ? `Image size: exactly ${w} × ${hMin} px, PNG, at most 64 KB.`
        : `Image size: ${w} × ${hMin} px, up to ${w} × ${hMax} px with an overhang, PNG, at most 64 KB.`,
    scale1: "1×",
    scale2: "2×",
    previewNA: "Preview not available",
    choose: "Choose package sprite",
    upload: "Upload image",
    useLibrary: "Use library sprite",
    useLibraryHint: "The custom image still shows until you remove it.",
    remove: "Remove custom image",
    saved: (dir: string) => `Saved for ${dir}`,
    removed: (dir: string) => `Removed for ${dir}`,
    thumbAlt: (name: string) => `Custom art of ${name}`,
    browser: {
      label: (dir: string) => `Package sprites for ${dir}`,
      count: (n: number) => `${n} ${n === 1 ? "sprite fits" : "sprites fit"}`,
      empty: "No package sprite fits this size.",
      staged: (key: string) => `Selected: ${key}`,
      tiles: (fw: number, fh: number, iw: number, ih: number, dir: string) =>
        `Frame ${fw} × ${fh} tiles, item ${iw} × ${ih} tiles for ${dir}`,
      smaller: "Smaller frames draw at the bottom-left.",
      use: "Use this sprite",
      cancel: "Cancel",
    },
    errors: {
      image_too_large: "The image is larger than 64 KB.",
      image_not_png: "This file is not a valid PNG image. Animated PNGs are not allowed.",
      image_bad_size: (dir: string, w: number, hMin: number, hMax: number, px?: string) =>
        `${px ? `This image is ${px} px. ` : ""}${dir} needs ${
          hMin === hMax
            ? `exactly ${w} × ${hMin} px`
            : `${w} × ${hMin} px, up to ${w} × ${hMax} px with an overhang`
        }.`,
      read_failed: "The file could not be read. Try again.",
      image_changed: "This image was changed by someone else. The latest art is shown now.",
    },
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
