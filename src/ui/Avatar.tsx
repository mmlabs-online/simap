import { initials } from "@/lib/format";

/** Initial-based circular avatar, optionally tinted by a group colour (then white text). */
export function Avatar({
  name,
  color,
  size = 44,
}: {
  name: string;
  color?: string;
  size?: number;
}) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-extrabold flex-none"
      style={{
        width: size,
        height: size,
        background: color ?? "var(--secondary-container)",
        color: color ? "#ffffff" : "var(--on-secondary-container)",
        fontSize: Math.round(size * 0.34),
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
