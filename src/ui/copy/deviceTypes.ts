import type { DeviceKind } from "@/lib/device-types/types";
import { IMAGE_LIMITS } from "@/lib/validate/png";

/** English strings of the Device types page (D36). API error messages come from `apiErrorMessage`. */
export const deviceTypesCopy = {
  noAccess: "Only admins can manage device types.",
  list: { title: "Catalog", empty: "No device types yet.", new: "New type" },
  edit: "Edit",
  delete: "Delete",
  editLabel: (name: string) => `Edit device type ${name}`,
  deleteLabel: (name: string) => `Delete device type ${name}`,
  form: {
    createTitle: "New device type",
    editTitle: "Edit device type",
    create: "Create type",
    name: "Name",
    slot: "Place on the desk",
    image: "Image",
    choose: "Choose PNG",
    replace: "Choose another PNG",
    remove: "Remove image",
    keepCurrent: "Keep current image",
    hint: `PNG, square, ${IMAGE_LIMITS.minPx} x ${IMAGE_LIMITS.minPx} to ${IMAGE_LIMITS.maxPx} x ${IMAGE_LIMITS.maxPx} px, up to ${IMAGE_LIMITS.maxBytes / 1024} KB`,
    pendingRemove: "The image will be removed when you save.",
    imageSaveFailed: "The type was saved, but the image was not. ",
    readFailed: "The file could not be read. Pick it again.",
    alt: { current: "Current image", staged: "New image, not saved yet", none: "No image" },
  },
  thumb: { none: "No image" },
  slots: {
    monitor: { label: "Monitor", hint: "Back of the desk (first right, second left)" },
    laptop: { label: "Laptop", hint: "Desk top in front of the seat" },
    pc: { label: "PC", hint: "Under the desk" },
    phone: { label: "Phone", hint: "Desk top at the side" },
    other: { label: "Other", hint: "Desk top" },
  } satisfies Record<DeviceKind, { label: string; hint: string }>,
  fieldErrors: {
    name: "Enter a name of up to 60 characters, without control characters.",
    slot: "Pick a place on the desk.",
    body: "Some of the information is not valid. Check it and try again.",
  },
  diagram: {
    chairSide: "Seat",
  },
  deleteDialog: {
    title: "Delete device type",
    body: (name: string) =>
      `Delete the type "${name}"? Devices with this type keep their type text and show the placeholder image on the map.`,
    confirm: "Delete type",
  },
} as const;
