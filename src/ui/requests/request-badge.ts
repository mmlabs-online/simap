import type { MyRequestDto } from "@/lib/requests/types";
import { shellCopy } from "../copy/shell";

type Seenable = Pick<MyRequestDto, "isNew" | "decidedAt">;

/**
 * The newest `decidedAt` among the rows still marked new, as the exact string the server sent. The server renders
 * decided instants in one fixed UTC format with microseconds, so plain string order is the time order; a `Date`
 * would drop the microseconds. With `after`, null unless something is newer than it.
 */
export function newestDecidedAt(items: Seenable[], after?: string | null): string | null {
  let newest: string | null = null;
  for (const it of items) {
    if (it.isNew && it.decidedAt !== null && (newest === null || it.decidedAt > newest)) {
      newest = it.decidedAt;
    }
  }
  if (newest === null) return null;
  return after != null && newest <= after ? null : newest;
}

/** The ids shown with a "New" chip: kept for the whole visit, even when a later page reports `isNew: false`. */
export function mergeNewIds(
  prev: ReadonlySet<string>,
  items: Pick<MyRequestDto, "id" | "isNew">[],
): ReadonlySet<string> {
  const fresh = items.filter((it) => it.isNew && !prev.has(it.id));
  return fresh.length === 0 ? prev : new Set([...prev, ...fresh.map((it) => it.id)]);
}

/** The visible badge text: nothing at 0, the number up to 9, then "9+". */
export function badgeText(n: number): string | null {
  if (n <= 0) return null;
  return n > 9 ? shellCopy.badge.overflow : String(n);
}
