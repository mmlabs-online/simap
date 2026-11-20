/** Permission tiers (D15: highest tier wins; D25: no Viewer tier in v1). */
export const TIERS = ["user", "manager", "admin"] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_RANK: Record<Tier, number> = { user: 0, manager: 1, admin: 2 };

export function atLeastTier(tier: Tier, min: Tier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[min];
}
