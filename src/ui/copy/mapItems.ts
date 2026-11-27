import type { Direction } from "@/lib/sprites/types";

/** English strings of the Map items page (D36). API error messages come from `apiErrorMessage`. */
export const mapItemsCopy = {
  noAccess: "Only admins can manage map items.",
  list: {
    empty: "The map item catalog is not ready yet. Try again in a moment.",
    hidden: "Hidden",
    fixed: "Fixed size",
  },
  editLabel: (name: string) => `Edit map item ${name}`,
  header: {
    eyebrow: "Build your little world",
    subtitle:
      "Small details. A space that feels like yours. Manage your room's sprites and objects.",
  },
  stats: {
    label: "Map item totals",
    total: (n: number) => (n === 1 ? "map item" : "map items"),
    inPalette: "in palette",
    customised: "customised",
    note: "32 px tile system · 4 directional sprites",
  },
  tabs: { label: "Item groups", all: "All" },
  search: { label: "Search items or library key", placeholder: "Search items or library key…" },
  grid: { heading: "Items", noMatch: "No items match. Try another group or search." },
  footer: {
    showing: (n: number, m: number) => `Showing ${n} of ${m} ${m === 1 ? "item" : "items"}`,
    note: "Items are never deleted. Hide an item to remove it from the local palette.",
  },
  card: {
    size: (w: number, h: number) => `${w} × ${h}`,
    sizeLabel: (w: number, h: number) => `${w} by ${h} tiles`,
    source: {
      image: "Custom image",
      sprite: "Package sprite",
      library: "Library sprite",
    } as Record<"image" | "sprite" | "library", string>,
  },
  form: {
    key: "Library key",
    name: "Name",
    group: "Group",
    shown: "Show in item palette",
    hideHint: "Hiding only removes it from the Add items palette; placed copies stay on the map.",
    chairNote:
      "The chair only sets the art of the chair drawn at each seat. It is never in the palette.",
    size: "Size (tiles)",
    width: "Width",
    height: "Height",
    inUseHint: "A size change is refused while the item is placed in any room.",
    rotationHint: "Size at rotation 0; east and west swap width and height.",
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
    fixedFootprint: "This item uses a fixed footprint.",
    keyNote: "Library key stays unchanged.",
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
  editor: {
    eyebrow: "Item editor",
    title: (name: string) => `Edit ${name}`,
    close: "Close item editor",
    tabsLabel: "Item editor sections",
    tabs: { appearance: "Appearance", details: "Details" },
    directional: "Directional artwork",
    neverRotated: "Never auto-rotated",
    dirsLabel: "Direction",
    previewCaption: (dir: string) => `${dir.toUpperCase()} · 2× PREVIEW`,
    removedOnSave: "Removed when you save the new size",
    sourceLabel: "Art source",
    sourceLibrary: "Sprite library",
    sourceUpload: "Upload image",
    choosePng: "Choose PNG file",
    onlyUpdates: (dir: string) => `Only updates the ${dir.toLowerCase()} view.`,
    restore: "Restore default",
    allTypes: "All types",
    search: "Find a sprite…",
    searchLabel: "Search sprites",
    noMatch: "No sprite matches.",
    droppedByResize: (dir: string) =>
      `The staged ${dir.toLowerCase()} art does not fit the new size and was dropped.`,
    status: {
      clean: "No unsaved changes",
      dirty: "Unsaved changes",
      saving: "Saving…",
      saved: "Saved.",
    },
    cancel: "Cancel",
    save: "Save changes",
    discard: { title: "Discard changes?", keep: "Keep editing", discard: "Discard" },
    changed: "changed",
    reset: {
      button: "Reset item to library defaults",
      lost: "Unsaved changes will be lost.",
      keep: "Keep editing",
    },
  },
  art: {
    single: "Art",
    sameForAll: "Same image in every direction",
    dirs: { n: "North", e: "East", s: "South", w: "West" } as Record<Direction, string>,
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
    upload: "Upload image",
    thumbAlt: (name: string) => `Custom art of ${name}`,
    atlasFailed: "Sprite previews could not be loaded. The sprite names are still listed.",
    frameAlt: (key: string, scale?: string) => (scale ? `${key} at ${scale}` : key),
    browser: {
      label: (dir: string) => `Package sprites for ${dir}`,
      count: (n: number) => `${n} ${n === 1 ? "sprite fits" : "sprites fit"}`,
      empty: "No package sprite fits this size.",
      tiles: (fw: number, fh: number, iw: number, ih: number, dir: string) =>
        `Frame ${fw} × ${fh} tiles, item ${iw} × ${ih} tiles for ${dir}`,
      smaller: "Smaller frames draw at the bottom-left.",
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
