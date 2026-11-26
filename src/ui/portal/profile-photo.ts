import {
  PHOTO_INPUT_LIMITS,
  centerSquare,
  fitToLimit,
  halvingSteps,
  targetSide,
} from "@/lib/photo-crop";
import {
  stripPhotoMetadata,
  validatePhoto,
  type PhotoCode,
  type PhotoType,
} from "@/lib/validate/photo";
import { apiErrorMessage } from "../copy/api";
import { portalCopy } from "../copy/portal";
import { canvasConverter, type PhotoConverter } from "./photo-canvas";

export type PhotoCheck =
  | { ok: true; bytes: Uint8Array<ArrayBuffer>; type: PhotoType }
  | {
      ok: false;
      code: PhotoCode | "read_failed" | "image_too_big_to_process" | "image_could_not_shrink";
    };

/**
 * Turns a picked file into bytes that meet the stored limits: decode (EXIF orientation applied), centered square,
 * resize, re-encode. Only encoder output is returned, never the input bytes. Never throws.
 */
export async function preparePhoto(
  file: Blob,
  converter: PhotoConverter = canvasConverter,
): Promise<PhotoCheck> {
  if (file.size > PHOTO_INPUT_LIMITS.maxBytes)
    return { ok: false, code: "image_too_big_to_process" };
  try {
    const source = await converter.decode(file);
    if (!source) return { ok: false, code: "read_failed" };
    let fit: Awaited<ReturnType<typeof fitToLimit>>;
    try {
      const { width, height } = source;
      if (!(width > 0 && height > 0)) return { ok: false, code: "read_failed" };
      if (width * height > PHOTO_INPUT_LIMITS.maxPixels) {
        return { ok: false, code: "image_too_big_to_process" };
      }
      const rect = centerSquare(width, height);
      const target = targetSide(rect.side);
      const rendered = await source.render(rect, halvingSteps(rect.side, target));
      if (!rendered) return { ok: false, code: "read_failed" };
      fit = await fitToLimit(rendered.encode, { hasAlpha: rendered.hasAlpha });
    } finally {
      source.close();
    }
    if (!fit.ok) return { ok: false, code: fit.code };
    const check = validatePhoto(fit.bytes);
    if (!check.ok) return { ok: false, code: check.code };
    if (check.type !== fit.type) return { ok: false, code: "image_not_supported" };
    return {
      ok: true,
      bytes: new Uint8Array(stripPhotoMetadata(fit.bytes, check.type)),
      type: check.type,
    };
  } catch {
    return { ok: false, code: "read_failed" };
  }
}

const photoErrors: Record<string, string> = portalCopy.profile.photo.errors;

/** The photo limits differ from the device-type image limits, so the photo codes use the photo copy. */
export function photoErrorMessage(code: string): string {
  return photoErrors[code] ?? apiErrorMessage(code);
}
