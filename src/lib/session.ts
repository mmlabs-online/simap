import type { Tier } from "./tier";

/** What the shell knows about the signed-in user. `null` means signed out. */
export type Session = { tier: Tier; email: string; orgName?: string; devToken?: DevBadge };
/**
 * Set only by the dev-token gate (SIM-028.1). Carries its own text, so the shell holds no dev-only strings; `prod` is
 * the red "Production data" variant (`pnpm dev:prod`). It only changes the badge and grants nothing.
 */
export type DevBadge = { label: string; tooltip: string; prod?: true };
