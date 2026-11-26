import { PHOTO_LIMITS, type PhotoType } from "@/lib/validate/photo";

/** What the browser accepts to read before converting a picked photo (not the stored limits, see PHOTO_LIMITS). */
export const PHOTO_INPUT_LIMITS = { maxBytes: 20 * 1024 * 1024, maxPixels: 50_000_000 } as const;

export type SquareRect = { sx: number; sy: number; side: number };

/** The largest centered square of a width x height image. */
export function centerSquare(width: number, height: number): SquareRect {
  const side = Math.min(width, height);
  return { sx: Math.floor((width - side) / 2), sy: Math.floor((height - side) / 2), side };
}

/** The stored side: the square side clamped to the allowed range (small images scale up to the minimum). */
export function targetSide(side: number): number {
  return Math.min(PHOTO_LIMITS.maxPx, Math.max(PHOTO_LIMITS.minPx, side));
}

/** Draw sizes for repeated halving (better quality than one big shrink); the last step is always the target. */
export function halvingSteps(side: number, target: number): number[] {
  const steps: number[] = [];
  let s = side;
  while (s / 2 >= target) {
    s = Math.floor(s / 2);
    steps.push(s);
  }
  if (steps[steps.length - 1] !== target) steps.push(target);
  return steps;
}

export const JPEG_QUALITIES = [0.92, 0.85, 0.78, 0.7, 0.6, 0.5, 0.4] as const;

export type FitResult =
  | { ok: true; bytes: Uint8Array<ArrayBuffer>; type: PhotoType }
  | { ok: false; code: "image_could_not_shrink" | "read_failed" };

/** PNG once when the image has transparency, then the JPEG quality ladder; the first result within maxBytes wins. */
export async function fitToLimit(
  encode: (type: PhotoType, quality?: number) => Promise<Uint8Array<ArrayBuffer> | null>,
  { hasAlpha, maxBytes = PHOTO_LIMITS.maxBytes }: { hasAlpha: boolean; maxBytes?: number },
): Promise<FitResult> {
  if (hasAlpha) {
    const png = await encode("png");
    if (!png) return { ok: false, code: "read_failed" };
    if (png.length <= maxBytes) return { ok: true, bytes: png, type: "png" };
  }
  for (const q of JPEG_QUALITIES) {
    const jpeg = await encode("jpeg", q);
    if (!jpeg) return { ok: false, code: "read_failed" };
    if (jpeg.length <= maxBytes) return { ok: true, bytes: jpeg, type: "jpeg" };
  }
  return { ok: false, code: "image_could_not_shrink" };
}
