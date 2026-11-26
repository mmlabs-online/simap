import type { DeviceDto } from "@/lib/devices/types";
import { deviceTypeKey } from "@/lib/device-types/name";
import type { IconName } from "@/lib/icons";
import { foldText, macCompact } from "@/lib/search/fold";

export type TypeOption = { key: string; label: string; count: number };

/** Loaded devices grouped by the D61 type key; label is the first-seen trimmed name; count desc, then key. */
export function typeSummary(devices: DeviceDto[]): TypeOption[] {
  const map = new Map<string, TypeOption>();
  for (const d of devices) {
    const key = deviceTypeKey(d.type);
    const o = map.get(key);
    if (o) o.count += 1;
    else map.set(key, { key, label: d.type.trim(), count: 1 });
  }
  return [...map.values()].sort(
    (a, b) => b.count - a.count || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
}

const macPlain = (mac: string) => mac.replace(/[:.-]/g, "").toLowerCase();

/** Client-side search (name, inventory no., MAC; case, diacritics and MAC separators ignored) AND type filter. */
export function filterDevices(devices: DeviceDto[], query: string, typeKey: string): DeviceDto[] {
  const q = foldText(query.replace(/\s+/gu, " ").trim());
  const mc = macCompact(query.trim());
  return devices.filter((d) => {
    if (typeKey !== "" && deviceTypeKey(d.type) !== typeKey) return false;
    if (q === "") return true;
    if (foldText(d.name).includes(q) || foldText(d.inventoryNumber).includes(q)) return true;
    if (d.mac === null) return false;
    return foldText(d.mac).includes(q) || (mc !== null && macPlain(d.mac).includes(mc));
  });
}

/** The selected type key, or "" when no option has it any more. */
export const effectiveType = (options: TypeOption[], typeKey: string): string =>
  options.some((o) => o.key === typeKey) ? typeKey : "";

/** A tile or chip count; `atLeast` formats the "more pages exist" form. */
export const tileValue = (n: number, more: boolean, atLeast: (n: number) => string): string =>
  more ? atLeast(n) : String(n);

export const typeIcon = (type: string): IconName =>
  deviceTypeKey(type) === "monitor" ? "desktop_windows" : "grid_view";
