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

/** Longest token lifetime (exp - iat, seconds) accepted on the super-admin path (D86). */
export const SUPER_ADMIN_MAX_TTL_S = 3600;

export type AccessInput = {
  orgRoles: readonly string[];
  appRoles?: readonly string[];
  orgAccess?: string | null;
  lifetimeS?: number;
};

/**
 * Tier and how it was granted (D75/D86). `org_access === "super_admin"` takes the super-admin path only: admin
 * when the configured key is in `roles` (exact match), `org_roles` is empty and the token lives <= 3600 s;
 * otherwise null (never falls back to the member path). Any other `org_access` uses `org_roles` and ignores `roles`.
 */
export function accessFromToken(
  input: AccessInput,
  superAdminKey: string | null,
): { tier: Tier; via: "member" | "super_admin" } | null {
  if (input.orgAccess === "super_admin") {
    const ok =
      superAdminKey !== null &&
      superAdminKey !== "" &&
      (input.appRoles ?? []).includes(superAdminKey) &&
      input.orgRoles.length === 0 &&
      typeof input.lifetimeS === "number" &&
      input.lifetimeS <= SUPER_ADMIN_MAX_TTL_S;
    return ok ? { tier: "admin", via: "super_admin" } : null;
  }
  const tier = tierFromOrgRoles(input.orgRoles);
  return tier ? { tier, via: "member" } : null;
}
