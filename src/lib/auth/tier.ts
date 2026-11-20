export type Tier = "user" | "manager" | "admin";

export const TIER_RANK: Record<Tier, number> = { user: 1, manager: 2, admin: 3 };

const ROLE_TIER: Record<string, Tier> = {
  "simap:admin": "admin",
  "simap:manager": "manager",
  "simap:user": "user",
};

/** True when `tier` is at least `min` (user < manager < admin). */
export function atLeast(tier: Tier, min: Tier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[min];
}

/** Highest simap tier in an org_roles list (D15); exact keys only, everything else is ignored. */
export function tierFromOrgRoles(roles: readonly string[]): Tier | null {
  let best: Tier | null = null;
  for (const r of roles) {
    const t = Object.hasOwn(ROLE_TIER, r) ? ROLE_TIER[r] : undefined;
    if (t && (!best || TIER_RANK[t] > TIER_RANK[best])) best = t;
  }
  return best;
}
