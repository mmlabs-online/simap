import type { Tier } from "@/lib/auth/tier";

/** Which devices a tier may read: the whole org, or only the ones it holds (DEV-12, D69). */
export type DeviceVisibility = "org" | "held";

export const deviceVisibility = (tier: Tier): DeviceVisibility =>
  tier === "user" ? "held" : "org";
