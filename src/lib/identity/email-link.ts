const TOKEN_HASH_RE = /^#token=([A-Za-z0-9_-]{32,128})$/;

/** The token of an email link hash (`#token=…`), or null when the hash is anything else. */
export function readLinkToken(hash: string): string | null {
  const m = TOKEN_HASH_RE.exec(hash);
  return m ? m[1] : null;
}

export type LinkDeps = {
  location: { hash: string; search: string };
  history: { replaceState(data: null, unused: string, url: string): void };
};

/**
 * Reads the email-link token once and removes the fragment and any query from the address bar before returning, so
 * the token never stays in history. A `?token=` query is never read. Call it before any network call.
 */
export function takeLinkToken(deps: LinkDeps, path: string): string | null {
  const { hash, search } = deps.location;
  const token = readLinkToken(hash);
  if (hash !== "" || search !== "") deps.history.replaceState(null, "", path);
  return token;
}
