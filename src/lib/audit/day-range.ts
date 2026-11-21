const OFFSET_MS = 7 * 3_600_000;
const DAY_RE = /^(\d{4})-(\d\d)-(\d\d)$/;

/** Start of the calendar day `YYYY-MM-DD` in UTC+7 (D35) as epoch ms, or null if not a real date. */
function dayStart(day: string): number | null {
  const m = DAY_RE.exec(day);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const utc = new Date(Date.UTC(y, mo - 1, d));
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== mo - 1 || utc.getUTCDate() !== d) {
    return null;
  }
  return utc.getTime() - OFFSET_MS;
}

/**
 * Calendar days in UTC+7 -> UTC instants for the audit API. `from` is the start of its day, `to` is the
 * start of the day after its day (exclusive). A blank day leaves its key out. Invalid input, or a range
 * where from >= to, returns null.
 */
export function dayRangeToInstants(
  fromDay?: string,
  toDay?: string,
): { from?: string; to?: string } | null {
  const out: { from?: string; to?: string } = {};
  let from: number | undefined;
  let to: number | undefined;
  if (fromDay) {
    const s = dayStart(fromDay);
    if (s === null) return null;
    from = s;
    out.from = new Date(s).toISOString();
  }
  if (toDay) {
    const s = dayStart(toDay);
    if (s === null) return null;
    to = s + 86_400_000;
    out.to = new Date(to).toISOString();
  }
  if (from !== undefined && to !== undefined && from >= to) return null;
  return out;
}
