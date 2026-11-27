import { workDateUtc7 } from "./work-date";

const OFFSET_RE = /(Z|[+-]\d{2}:?\d{2})$/i;

/**
 * G2: the check-in time of a provider record. No `at` = `now`. An `at` needs an explicit offset, is clamped to
 * "not after now" and must fall on today's UTC+7 work date (PRE-05); anything else is `null` (dropped).
 */
export function providerCheckInAt(at: string | undefined, now: Date): Date | null {
  if (at === undefined) return now;
  if (!OFFSET_RE.test(at)) return null;
  const t = Date.parse(at);
  if (Number.isNaN(t)) return null;
  const parsed = new Date(t);
  if (workDateUtc7(parsed) !== workDateUtc7(now)) return null;
  return t > now.getTime() ? now : parsed;
}
