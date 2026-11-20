import type { Tier } from "./tier";

/** What the shell knows about the signed-in user. `null` means signed out. */
export type Session = { tier: Tier; email: string; orgName?: string };
