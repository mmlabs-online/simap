/**
 * Material Symbols used by the app, alphabetical (the Google Fonts `icon_names` subset requires it).
 * Add a name here before using it; `Icon` only accepts these.
 */
export const ICON_NAMES = [
  "add",
  "arrow_forward",
  "auto_awesome",
  "block",
  "category",
  "chair",
  "check",
  "close",
  "dark_mode",
  "desktop_windows",
  "edit",
  "edit_square",
  "event",
  "event_seat",
  "fact_check",
  "factory",
  "grid_view",
  "group",
  "history",
  "inbox",
  "lan",
  "light_mode",
  "lock",
  "login",
  "logout",
  "mail",
  "meeting_room",
  "palette",
  "person",
  "qr_code",
  "restart_alt",
  "search",
  "sell",
  "space_dashboard",
  "swap_horiz",
  "sync",
  "upload",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export function iconFontHref(): string {
  return (
    "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,300..600,0..1,0" +
    `&icon_names=${ICON_NAMES.join(",")}&display=block`
  );
}
