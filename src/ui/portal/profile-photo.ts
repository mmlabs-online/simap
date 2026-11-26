import {
  PHOTO_LIMITS,
  stripPhotoMetadata,
  validatePhoto,
  type PhotoCode,
  type PhotoType,
} from "@/lib/validate/photo";
import { apiErrorMessage } from "../copy/api";
import { portalCopy } from "../copy/portal";

export type PhotoCheck =
  | { ok: true; bytes: Uint8Array<ArrayBuffer>; type: PhotoType }
  | { ok: false; code: PhotoCode | "read_failed" };

/** Client-side check before sending: size first (no read), then the structure; metadata is stripped like on the server. */
export async function checkPhotoFile(file: {
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}): Promise<PhotoCheck> {
  if (file.size > PHOTO_LIMITS.maxBytes) return { ok: false, code: "image_too_large" };
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { ok: false, code: "read_failed" };
  }
  const check = validatePhoto(bytes);
  if (!check.ok) return { ok: false, code: check.code };
  return {
    ok: true,
    bytes: new Uint8Array(stripPhotoMetadata(bytes, check.type)),
    type: check.type,
  };
}

const photoErrors: Record<string, string> = portalCopy.profile.photo.errors;

/** The photo limits differ from the device-type image limits, so the photo codes use the photo copy. */
export function photoErrorMessage(code: string): string {
  return photoErrors[code] ?? apiErrorMessage(code);
}
