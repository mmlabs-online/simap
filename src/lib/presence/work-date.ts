const OFFSET_MS = 7 * 3600_000;

/** D79: the work date (`YYYY-MM-DD`) of an instant, a fixed UTC+7 day for every org (no DST). Throws on an invalid Date. */
export function workDateUtc7(now: Date): string {
  const t = now.getTime();
  if (Number.isNaN(t)) throw new RangeError("workDateUtc7: invalid Date");
  return new Date(t + OFFSET_MS).toISOString().slice(0, 10);
}
