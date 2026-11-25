import { IMAGE_LIMITS, validatePng } from "@/lib/validate/png";
import { apiErrorMessage } from "../copy/api";
import { deviceTypesCopy } from "../copy/deviceTypes";

export type ImageCheckCode = "image_too_large" | "image_not_png" | "image_bad_size" | "read_failed";
export type ImageCheck =
  | { ok: true; bytes: Uint8Array<ArrayBuffer> }
  | { ok: false; code: ImageCheckCode };

/** Client-side check before sending: size first (no read), then the PNG structure. Ignores file type and name. */
export async function checkImageFile(file: {
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}): Promise<ImageCheck> {
  if (file.size > IMAGE_LIMITS.maxBytes) return { ok: false, code: "image_too_large" };
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { ok: false, code: "read_failed" };
  }
  if (bytes.length > IMAGE_LIMITS.maxBytes) return { ok: false, code: "image_too_large" };
  const png = validatePng(bytes);
  return png.ok ? { ok: true, bytes } : { ok: false, code: png.code };
}

export function imageCheckMessage(code: ImageCheckCode): string {
  return code === "read_failed" ? deviceTypesCopy.form.readFailed : apiErrorMessage(code);
}

export type ImageDraft =
  | { kind: "keep" }
  | { kind: "replace"; bytes: Uint8Array<ArrayBuffer>; url: string }
  | { kind: "remove" };

export type ImageFieldView = {
  previewUrl: string | null;
  state: "none" | "current" | "staged" | "remove";
  showRemove: boolean;
  showUndo: boolean;
};

export function imageFieldView(
  draft: ImageDraft,
  hasImage: boolean,
  currentUrl: string | null,
): ImageFieldView {
  if (draft.kind === "replace") {
    return { previewUrl: draft.url, state: "staged", showRemove: true, showUndo: false };
  }
  if (draft.kind === "remove") {
    return { previewUrl: null, state: "remove", showRemove: false, showUndo: true };
  }
  return {
    previewUrl: hasImage ? currentUrl : null,
    state: hasImage && currentUrl ? "current" : "none",
    showRemove: hasImage,
    showUndo: false,
  };
}
