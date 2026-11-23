import type { ShortcutId } from "@/lib/layout-editor/shortcuts";
import type { SaveDetail } from "@/lib/layout-editor/save-run";

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
  editLayout: "Edit layout",
  editor: {
    title: "Edit room layout",
    checking: "Checking your access...",
    loading: "Loading the layout...",
    backToRoom: "Back to the room",
    backToRooms: "Back to rooms",
    notAllowed: {
      title: "You can't edit this layout",
      body: "Only admins can edit a room layout.",
    },
    desktop: {
      title: "Use a desktop to edit the layout",
      body: "The layout editor needs a wider screen. Open this page on a desktop or a laptop.",
    },
    readOnly: (n: number) =>
      `This room has more than ${n} seats, so the editor can't open it. Use the seat table to manage its seats.`,
    missing: "This room doesn't exist.",
    error: "The layout could not be loaded.",
    undo: "Undo",
    save: "Save layout",
    saving: "Saving...",
    unsaved: "Unsaved changes",
    reload: "Reload",
    tryAgain: "Try again",
    conflictNote: "Reloading discards your unsaved changes.",
    saveErrors: {
      seats_unmatched:
        "New seats were created but could not be matched to desks. Reload the editor; they will be in Seats not placed.",
    } as Record<string, string>,
    saveDetail: (d: SaveDetail) => {
      const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
      const parts: string[] = [];
      if (d.seat !== null) {
        parts.push(
          `Desk ${d.seat} was not deleted and is back ${d.restored === "tray" ? "in Seats not placed" : "on the map"}.`,
        );
      }
      if (d.deleted > 0) {
        parts.push(`${d.deleted} ${plural(d.deleted, "seat was", "seats were")} deleted.`);
      }
      if (d.created > 0) {
        parts.push(
          `${d.created} new ${plural(d.created, "seat was", "seats were")} created${
            d.stage === "assign" ? "." : ", but the layout was not saved. Save again to place them."
          }`,
        );
      }
      return parts.join(" ");
    },
    saveBlock: {
      unplaced: "Place all seats before saving.",
      read_only: "This layout is read-only.",
      invalid: "This layout can't be saved yet. Check the limits for items and floors.",
    },
    refused: {
      layout_out_of_bounds: "That would leave the room.",
      layout_overlap: "That tile is taken.",
      layout_bad_rotation: "Nothing selected can turn.",
      layout_unknown_sprite: "That item doesn't exist.",
      seat_limit: "This room already has the most seats it can hold.",
      fixture_limit: "This room already has the most fixtures it can hold.",
      resize_cut: "Some items would be outside the smaller room. Move or delete them first.",
    },
    done: {
      moved: "Moved.",
      rotated: "Turned.",
      deleted: "Deleted.",
      undone: "Undone.",
      saved: "Saved.",
      placed: "Placed.",
      resized: "Room size changed.",
    },
    palette: {
      heading: "Add items",
      groups: {
        desk: "Desks",
        cabinet: "Cabinets",
        circulation: "Stairs and lifts",
        door: "Doors",
        label: "Labels",
        lamp: "Lamps",
        marker: "Markers",
        partition: "Partitions",
        plant: "Plants",
        prop: "Props",
        rack: "Racks",
        shelf: "Shelves",
        sofa: "Sofas",
        table: "Tables",
        wall: "Walls",
        whiteboard: "Whiteboards",
        window: "Windows",
      } as Record<string, string>,
      armed: (name: string) =>
        `Placing ${name}. Click a tile on the map, or enter a tile and press Place. Esc stops.`,
      x: "X",
      y: "Y",
      place: "Place",
      done: "Done placing",
      badTile: "Enter whole numbers for X and Y.",
    },
    leave: {
      title: "Leave without saving?",
      body: "Your unsaved layout changes will be lost.",
      stay: "Stay",
      leave: "Leave",
    },
    inspector: {
      heading: "Selection",
      none: "Nothing selected. Click an item on the map or pick one from the list.",
      count: (n: number) => `${n} items selected`,
      position: (x: number, y: number, rotation: number) =>
        `Tile ${x}, ${y}, turned ${rotation} degrees`,
      rotate: "Rotate",
      delete: "Delete",
      moveLabel: "Move by one tile",
      up: "Up",
      down: "Down",
      left: "Left",
      right: "Right",
      roomSize: (w: number, h: number) => `Room size: ${w} x ${h} tiles`,
      trayHeading: (n: number) => `Seats not placed (${n})`,
      placeSeat: (code: string) => `Place ${code}`,
      sizeW: "Width",
      sizeH: "Height",
      sizeApply: "Apply size",
      sizeBad: "Enter a whole number from 1 to 64.",
      itemsHeading: "Items",
      itemsEmpty: "This room has no items.",
      deleteSeatNote:
        "Deleting a desk deletes its seat when you save. A seat with an occupant or devices is kept.",
    },
    shortcuts: {
      summary: "Keyboard shortcuts",
      rows: {
        rotate: { keys: ["R"], action: "Turn the selection" },
        delete: { keys: ["Delete", "Backspace"], action: "Delete the selection" },
        nudge: {
          keys: ["Arrow keys"],
          action: "Move the selection by one tile. Moves in a row undo together.",
        },
        undo: { keys: ["Ctrl+Z", "Cmd+Z"], action: "Undo" },
        save: { keys: ["Ctrl+S", "Cmd+S"], action: "Save the layout" },
        escape: { keys: ["Esc"], action: "Cancel a drag, stop placing, or clear the selection" },
      } satisfies Record<ShortcutId, { keys: readonly string[]; action: string }>,
      mouseHeading: "Mouse",
      mouse: [
        { keys: "Drag an item", action: "Move the selection" },
        { keys: "Drag on empty floor", action: "Select an area" },
        { keys: "Shift", action: "Add to the selection" },
      ],
    },
    itemName: (item: { kind: "seat" | "fixture"; sprite: string; code: string | null }) =>
      item.kind === "seat"
        ? item.code === null
          ? "New desk"
          : `Desk ${item.code}`
        : item.sprite.replaceAll(".", " "),
    itemAt: (name: string, x: number, y: number) => `${name} at ${x}, ${y}`,
  },
} as const;
