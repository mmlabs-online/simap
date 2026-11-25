/** The label shown when no release tag was passed to the build (local dev, CI image check). */
export const DEV_VERSION = "dev";

const RELEASE_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** A release tag `vX.Y.Z` (at most 32 chars) passes through; anything else, including unset, is `dev` (SIM-040). */
export function parseVersion(raw: string | undefined): string {
  return raw !== undefined && raw.length <= 32 && RELEASE_TAG.test(raw) ? raw : DEV_VERSION;
}
