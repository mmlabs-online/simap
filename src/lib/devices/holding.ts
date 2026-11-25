const OFFSET_MS = 7 * 3_600_000;
const DAY_RE = /^(\d{4})-(\d\d)-(\d\d)$/;

/** Today's calendar date in UTC+7 (D35) as `YYYY-MM-DD`. The clock is injected. */
export function todayUtc7(now: Date): string {
  return new Date(now.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** A strict `YYYY-MM-DD` that is a real date in years 2000-2100, or null. */
export function parseCalendarDay(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const m = DAY_RE.exec(s);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 2000 || y > 2100) return null;
  const utc = new Date(Date.UTC(y, mo - 1, d));
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== mo - 1 || utc.getUTCDate() !== d) {
    return null;
  }
  return s;
}
