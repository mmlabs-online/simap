import type { Tier } from "@/lib/auth/tier";

/** Roles an invitation may carry. `simap:admin` is appointed in the admin portal, never from simap (spec §2). */
export const INVITABLE_ROLES = ["simap:user", "simap:manager"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

const OPTIONS: Record<Tier, readonly InvitableRole[]> = {
  user: [],
  manager: ["simap:user"],
  admin: ["simap:user", "simap:manager"],
};

/** The roles a person of this tier may offer; never above their own. */
export function inviteRoleOptions(tier: Tier): readonly InvitableRole[] {
  return OPTIONS[tier];
}

/** Exact-string check: no trimming, no case folding. */
export function canInviteRole(tier: Tier, role: unknown): role is InvitableRole {
  return typeof role === "string" && (OPTIONS[tier] as readonly string[]).includes(role);
}
