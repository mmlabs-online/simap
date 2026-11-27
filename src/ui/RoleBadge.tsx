import type { Tier } from "@/lib/tier";
import { shellCopy } from "./copy/shell";

const TIER_CLASSES: Record<Tier, string> = {
  user: "border-border bg-canvas text-text-secondary",
  manager: "border-info/40 bg-info-tint text-info",
  admin: "border-transparent bg-text-primary text-surface",
};

/** Tier tag. Uppercase, hairline-bordered; admin is the solid chip. The label is text, so status is never colour alone. */
export function RoleBadge({ tier, className = "" }: { tier: Tier; className?: string }) {
  return (
    <span
      className={`inline-flex flex-none items-center rounded-sm border px-2 text-caption font-medium uppercase tracking-wide ${TIER_CLASSES[tier]} ${className}`}
    >
      {shellCopy.tiers[tier]}
    </span>
  );
}
