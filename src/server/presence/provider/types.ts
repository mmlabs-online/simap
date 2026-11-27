import "server-only";

export type { MemberRef, ProviderCheckInInput } from "@/lib/validate/provider-checkin";

/**
 * PRE-04 / D83: a third-party check-in system that simap pulls from (no webhook). `pull` returns the raw payload
 * `{ checkIns: [...] }`; the puller validates it with `parseProviderPull`, so every provider is checked the same
 * way. Paging, auth and retries live inside a provider's `pull`.
 */
export interface CheckInProvider {
  readonly id: string;
  pull(req: { workDate: string; signal: AbortSignal }): Promise<unknown>;
}

export type ProviderPullErrorCode = "timeout" | "provider_error" | "bad_response";

/** A pull failure with a fixed code and a static message (never the provider's text, URL, token or payload). */
export class ProviderPullError extends Error {
  constructor(readonly code: ProviderPullErrorCode) {
    super(`provider pull failed: ${code}`);
  }
}
