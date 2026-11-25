import type { DeviceHistoryEntryDto, DeviceHistoryKind, MemberRef } from "@/lib/devices/types";
import { devicesCopy } from "../copy/devices";

const copy = devicesCopy.history;

export const historyKindLabel = (kind: DeviceHistoryKind): string => copy.kinds[kind];

/** A member with no row (or a removed one) shows as "Unknown member". */
export const historyMemberLabel = (ref: MemberRef | null): string =>
  ref?.displayName ?? copy.unknownMember;

/**
 * "From → to" for the kinds that move the device. A null `from` on assign and a null `to` on a return mean the org
 * inventory. Edits and extensions show the one member they concern; a create shows nothing.
 */
export function historyFromTo(e: DeviceHistoryEntryDto): string | null {
  const inventory = devicesCopy.orgInventory;
  switch (e.kind) {
    case "create":
      return null;
    case "holding_update":
      return historyMemberLabel(e.to);
    case "extension_start":
    case "extension_cancel":
    case "extension_decline":
    case "extension_confirm":
      return historyMemberLabel(e.from);
    case "assign":
      return copy.fromTo(inventory, historyMemberLabel(e.to));
    case "return_start":
    case "return_cancel":
    case "return_confirm":
    case "return_take_back":
      return copy.fromTo(historyMemberLabel(e.from), inventory);
    default:
      return copy.fromTo(historyMemberLabel(e.from), historyMemberLabel(e.to));
  }
}

/** "Expires 2026-12-31", "Expiry 2026-01-01 → 2026-02-02" or null. Dates are shown as given, never through `Date`. */
export function historyExpiryText(e: DeviceHistoryEntryDto): string | null {
  if (e.expiresOn !== null) {
    return e.fromExpiresOn !== null
      ? copy.expiryChange(e.fromExpiresOn, e.expiresOn)
      : copy.expiry(e.expiresOn);
  }
  return e.fromExpiresOn !== null ? copy.expiryChange(e.fromExpiresOn, copy.noExpiry) : null;
}

export function historyCause(e: DeviceHistoryEntryDto): string | null {
  return e.cause === null ? null : copy.causes[e.cause];
}
