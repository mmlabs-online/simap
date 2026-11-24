import { atLeastTier, type Tier } from "@/lib/tier";

/** Managers and Admins open the page (the API enforces it too). */
export function canManageGroups(tier: Tier | null | undefined): boolean {
  return tier ? atLeastTier(tier, "manager") : false;
}
