import "server-only";

export class DriveConfigError extends Error {}

export type DriveConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  folderId: string;
};

const NAMES = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
  "DRIVE_FOLDER_ID",
] as const;

/** Drive file and folder ids. */
export const DRIVE_ID_RE = /^[A-Za-z0-9_-]{10,200}$/;

/**
 * An empty string counts as unset. All four unset: off. All four set and valid: on. Anything else throws, naming
 * variables only, never values.
 */
export function loadDriveConfig(
  env: Record<string, string | undefined>,
): { mode: "off" } | ({ mode: "on" } & DriveConfig) {
  const vals = NAMES.map((n) => env[n] || "");
  const missing = NAMES.filter((_, i) => !vals[i]);
  if (missing.length === NAMES.length) return { mode: "off" };
  if (missing.length > 0) {
    throw new DriveConfigError(`Google Drive config is incomplete, missing: ${missing.join(", ")}`);
  }
  const bad: string[] = NAMES.filter((_, i) => /\s/.test(vals[i]));
  const [clientId, clientSecret, refreshToken, folderId] = vals;
  if (!bad.includes(NAMES[0]) && !clientId.endsWith(".apps.googleusercontent.com")) {
    bad.push(NAMES[0]);
  }
  if (!bad.includes(NAMES[3]) && !DRIVE_ID_RE.test(folderId)) bad.push(NAMES[3]);
  if (bad.length > 0) {
    throw new DriveConfigError(`malformed Google Drive config: ${bad.join(", ")}`);
  }
  return { mode: "on", clientId, clientSecret, refreshToken, folderId };
}
