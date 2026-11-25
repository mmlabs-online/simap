import { spriteFits } from "@/lib/map-items/art";
import { MAP_ITEM_DIRS, type MapItemDto, type MapItemPatchValue } from "@/lib/map-items/types";
import { validateMapItemPatch } from "@/lib/validate/map-item";

export type MapItemForm = {
  name: string;
  group: string;
  shown: boolean;
  w: number;
  h: number;
  confirmResize: boolean;
};

export const formFromItem = (item: MapItemDto): MapItemForm => ({
  name: item.name,
  group: item.group,
  shown: !item.hidden,
  w: item.w,
  h: item.h,
  confirmResize: false,
});

/** What a resize removes: custom images (all of them) and package sprites that no longer fit. */
export function resizeEffects(
  item: MapItemDto,
  w: number,
  h: number,
): { images: number; sprites: number } {
  if (w === item.w && h === item.h) return { images: 0, sprites: 0 };
  let images = 0;
  let sprites = 0;
  for (const d of MAP_ITEM_DIRS) {
    const art = item.art[d];
    if (art.hasImage) images += 1;
    if (art.sprite !== null && !spriteFits(art.sprite, d, w, h)) sprites += 1;
  }
  return { images, sprites };
}

export type PatchResult =
  | { kind: "unchanged" }
  | { kind: "invalid"; field: string }
  | { kind: "needsConfirm" }
  | { kind: "patch"; value: MapItemPatchValue };

/** The changed fields only, normalised by the server's own validator. */
export function patchFrom(item: MapItemDto, form: MapItemForm): PatchResult {
  const candidate: Record<string, unknown> = { name: form.name, group: form.group };
  if (item.kind !== "chair") candidate.hidden = !form.shown;
  if (!item.fixedSize) {
    candidate.w = form.w;
    candidate.h = form.h;
  }
  const checked = validateMapItemPatch(candidate);
  if (!checked.ok) return { kind: "invalid", field: checked.field };
  const value: MapItemPatchValue = {};
  for (const key of ["name", "group", "hidden", "w", "h"] as const) {
    const next = checked.value[key];
    if (next !== undefined && next !== item[key]) Object.assign(value, { [key]: next });
  }
  if (Object.keys(value).length === 0) return { kind: "unchanged" };
  if (value.w !== undefined || value.h !== undefined) {
    const fx = resizeEffects(item, form.w, form.h);
    if (fx.images + fx.sprites > 0 && !form.confirmResize) return { kind: "needsConfirm" };
  }
  return { kind: "patch", value };
}
