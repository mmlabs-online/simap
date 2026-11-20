/**
 * Material Symbols used by the app, alphabetical (the Google Fonts `icon_names` subset requires it).
 * Add a name here before using it; `Icon` only accepts these.
 */
export const ICON_NAMES = [
  "add",
  "close",
  "dark_mode",
  "edit",
  "edit_square",
  "fact_check",
  "grid_view",
  "group",
  "lan",
  "light_mode",
  "login",
  "logout",
  "mail",
  "meeting_room",
  "person",
  "search",
  "space_dashboard",
  "swap_horiz",
  "sync",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export function iconFontHref(): string {
  return (
    "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,300..600,0..1,0" +
    `&icon_names=${ICON_NAMES.join(",")}&display=block`
  );
}
