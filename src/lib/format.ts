/** First letter of the first and last name part, upper-cased ("Nguyễn Văn An" -> "NA"); "?" when empty. */
export function initials(name: string): string {
  const parts = name
    .normalize("NFC")
    .replace(/\(.*?\)/g, " ")
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  const first = Array.from(parts[0])[0];
  const last = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] : "";
  return (first + last).toLocaleUpperCase("vi");
}

/** "30 seconds" / "2 minutes" / "1 hour" from a `Retry-After` in seconds, rounded up; unknown or not positive: "a few minutes". */
export function waitText(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "a few minutes";
  const unit = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
  if (seconds < 60) return unit(Math.ceil(seconds), "second");
  if (seconds < 3600) return unit(Math.ceil(seconds / 60), "minute");
  return unit(Math.ceil(seconds / 3600), "hour");
}
