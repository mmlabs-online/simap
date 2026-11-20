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
