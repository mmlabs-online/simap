import { parseVersion } from "@/lib/version";

/** The release tag baked in at build time (SIM-040); `dev` when the build got none. Literal access so Next inlines it. */
export const APP_VERSION = parseVersion(process.env.NEXT_PUBLIC_SIMAP_VERSION);
