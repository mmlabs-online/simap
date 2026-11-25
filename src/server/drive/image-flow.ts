import "server-only";
import { DriveError } from "@/server/drive/client";
import { DriveConfigError } from "@/server/drive/config";
import type { OrgDrive } from "@/server/drive/drive";

/** The drive is read lazily (a getter) so the org-scoped row lookup, and its 404, come before any Drive config. */
export type DriveGetter = () => OrgDrive | null;

export type ImageRefusal = {
  ok: false;
  status: 404 | 409 | 502 | 503;
  code: "not_found" | "image_changed" | "drive_error" | "images_unavailable";
};
export type ImageResult<T> = { ok: true; value: T } | ImageRefusal;

export type ImageGet =
  | { kind: "not_modified"; etag: string }
  | { kind: "bytes"; bytes: Uint8Array; etag: string };

export const IMAGE_NOT_FOUND: ImageRefusal = { ok: false, status: 404, code: "not_found" };
export const IMAGE_UNAVAILABLE: ImageRefusal = {
  ok: false,
  status: 503,
  code: "images_unavailable",
};
export const IMAGE_DRIVE_ERROR: ImageRefusal = { ok: false, status: 502, code: "drive_error" };

/**
 * The only path from a Drive failure to a response. The DriveCode is logged under `event` and never sent; no
 * Drive failure becomes 401/403 (R7). Anything that is not a Drive or Drive config error is rethrown (500 from
 * the wrapper).
 */
export function mapDriveFailure(err: unknown, op: string, event: string): ImageRefusal {
  if (err instanceof DriveConfigError) {
    console.error(JSON.stringify({ event, op, code: "drive_config" }));
    return IMAGE_UNAVAILABLE;
  }
  if (err instanceof DriveError) {
    console.error(JSON.stringify({ event, op, code: err.code }));
    return err.code === "drive_rate_limited" || err.code === "drive_unavailable"
      ? IMAGE_UNAVAILABLE
      : IMAGE_DRIVE_ERROR;
  }
  throw err;
}

export function useDrive(drive: DriveGetter): OrgDrive {
  const d = drive();
  if (!d) throw new DriveConfigError("drive is off");
  return d;
}

/** True when an If-None-Match header lists `etag` (weak prefix ignored) or `*`. */
export function etagMatches(header: string | null, etag: string): boolean {
  if (header === null) return false;
  return header.split(",").some((t) => {
    const v = t.trim().replace(/^W\//, "");
    return v === "*" || v === etag;
  });
}
