"use client";

import { createApiFetch, type ApiFetch } from "@/lib/api/fetch";
import { APP_KEY, identityBaseFrom, turnstileSiteKeyFrom } from "@/lib/identity/config";
import { createIdentityClient, type IdentityClient } from "./identityClient";
import { createTokenStore, type TokenStore } from "./tokenStore";

export type AuthRuntime = {
  client: IdentityClient;
  store: TokenStore;
  apiFetch: ApiFetch;
  turnstileSiteKey: string;
};

let runtime: AuthRuntime | null = null;
let authLost: () => void = () => {};

/** The mounted gate registers what happens when simap refuses a fresh token (401 after the retry). Returns the undo. */
export function setAuthLostHandler(fn: () => void): () => void {
  authLost = fn;
  return () => {
    if (authLost === fn) authLost = () => {};
  };
}

/** One token store per page load, shared by every gate. Lazy, so server rendering never builds a store. */
export function getAuthRuntime(): AuthRuntime {
  if (!runtime) {
    const production = process.env.NODE_ENV === "production";
    const baseUrl = identityBaseFrom(process.env.NEXT_PUBLIC_MM_IDENTITY_BASE, production);
    const turnstileSiteKey = turnstileSiteKeyFrom(
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      production,
    );
    const client = createIdentityClient({ baseUrl, app: APP_KEY });
    const store = createTokenStore({ client });
    const apiFetch = createApiFetch({ getToken: store.getToken, onAuthLost: () => authLost() });
    runtime = { client, store, apiFetch, turnstileSiteKey };
  }
  return runtime;
}
