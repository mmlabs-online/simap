/** Public identity constants. The Turnstile site key is public by design (no secret key here, R3). */
export const APP_KEY = "simap";
export const IDENTITY_BASE_PROD = "https://api.mmlabs.online/api/v1";
// Shared with tudocuatui for now (Ming, 2026-11-20); simap gets its own widget before go-live (SIM-021).
export const TURNSTILE_SITE_KEY_PROD = "0x4AAAAAAF_LLtCloZlzY0MY";
/** Names that keep several tabs of this app in step (renewal lock, cross-tab channel). */
export const AUTH_LOCK_NAME = "simap-auth-refresh";
export const AUTH_CHANNEL_NAME = "simap-auth";

const DEV_BASE_RE = /^(?:https:\/\/[A-Za-z0-9.-]+|http:\/\/localhost:\d{1,5})\/api\/v1$/;
const SITE_KEY_RE = /^[0-9A-Za-z_-]{1,64}$/;

/** Production always uses the constant; elsewhere a well-formed override (https host or http://localhost:<port>) wins. */
export function identityBaseFrom(raw: string | undefined, production: boolean): string {
  if (production || !raw || !DEV_BASE_RE.test(raw)) return IDENTITY_BASE_PROD;
  return raw;
}

export function turnstileSiteKeyFrom(raw: string | undefined, production: boolean): string {
  if (production || !raw || !SITE_KEY_RE.test(raw)) return TURNSTILE_SITE_KEY_PROD;
  return raw;
}
