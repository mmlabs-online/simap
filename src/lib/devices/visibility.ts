import type { Tier } from "@/lib/auth/tier";

/** Which devices a tier may read: the whole org, or only the ones it holds (DEV-12, D69). */
export type DeviceVisibility = "org" | "held";

export const deviceVisibility = (tier: Tier): DeviceVisibility =>
  tier === "user" ? "held" : "org";

/** A write on a device the actor may not read answers 404 like an unknown id (DEV-12, D69): a User who is not the owner. */
export const hiddenFromActor = (
  tier: Tier,
  ownerId: string | null,
  actorMemberId: string | null,
): boolean => deviceVisibility(tier) === "held" && !(ownerId !== null && ownerId === actorMemberId);

/** Same for a handoff: a User who is neither its sender nor its recipient. */
export const hiddenHandoffFromActor = (
  tier: Tier,
  actorMemberId: string | null,
  fromId: string,
  toId: string | null,
): boolean =>
  deviceVisibility(tier) === "held" &&
  !(actorMemberId !== null && (actorMemberId === fromId || actorMemberId === toId));
