import type { Tier } from "@/lib/tier";
import { shellCopy } from "./copy/shell";

const TIER_STYLES: Record<Tier, { bg: string; fg: string; border: string }> = {
  user: {
    bg: "var(--secondary-container)",
    fg: "var(--on-secondary-container)",
    border: "color-mix(in srgb, var(--secondary) 35%, transparent)",
  },
  manager: {
    bg: "var(--tertiary-container)",
    fg: "var(--on-tertiary-container)",
    border: "color-mix(in srgb, var(--tertiary) 40%, transparent)",
  },
  admin: {
    bg: "var(--primary)",
    fg: "var(--on-primary)",
    border: "transparent",
  },
};

/** Tier tag. Uppercase, hairline-bordered; admin is the solid chip. The label is text, so status is never colour alone. */
export function RoleBadge({ tier, className = "" }: { tier: Tier; className?: string }) {
  const s = TIER_STYLES[tier];
  return (
    <span
      className={`inline-flex items-center rounded-[8px] px-2 py-[3px] text-[10px] font-extrabold uppercase tracking-[0.06em] border flex-none ${className}`}
      style={{ background: s.bg, color: s.fg, borderColor: s.border }}
    >
      {shellCopy.tiers[tier]}
    </span>
  );
}
