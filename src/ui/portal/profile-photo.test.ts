import { describe, expect, it, vi } from "vitest";
import { bytesOf, jpegOf, pngOf } from "@/test/photo-fixtures";
import { PHOTO_LIMITS, validatePhoto } from "@/lib/validate/photo";
import { apiCopy } from "../copy/api";
import { portalCopy } from "../copy/portal";
import { checkPhotoFile, photoErrorMessage } from "./profile-photo";

const fileOf = (bytes: Uint8Array) => ({
  size: bytes.length,
  arrayBuffer: async () =>
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) as ArrayBuffer,
});

describe("checkPhotoFile", () => {
  it("file over 256 KB returns image_too_large without calling arrayBuffer", async () => {
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(0));
    const r = await checkPhotoFile({ size: PHOTO_LIMITS.maxBytes + 1, arrayBuffer });
    expect(r).toEqual({ ok: false, code: "image_too_large" });
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it("arrayBuffer rejects: read_failed", async () => {
    const r = await checkPhotoFile({
      size: 10,
      arrayBuffer: async () => {
        throw new Error("x");
      },
    });
    expect(r).toEqual({ ok: false, code: "read_failed" });
  });

  it("non-square 100x80 PNG: image_bad_size; 32x32 and 600x600 JPEG: image_bad_size", async () => {
    for (const b of [pngOf(100, 80), jpegOf(32, 32), jpegOf(600, 600)]) {
      expect(await checkPhotoFile(fileOf(b))).toEqual({ ok: false, code: "image_bad_size" });
    }
  });

  it("GIF bytes, an empty file and a JPEG with bytes after EOI: image_not_supported", async () => {
    const gif = new TextEncoder().encode("GIF89a\x01\x00\x01\x00");
    for (const b of [
      gif,
      new Uint8Array(0),
      bytesOf([jpegOf(64, 64), new Uint8Array([1, 2, 3])]),
    ]) {
      expect(await checkPhotoFile(fileOf(b))).toEqual({ ok: false, code: "image_not_supported" });
    }
  });

  it("valid JPEG with Exif: ok, type jpeg, returned bytes have no APP1 segment and still pass validatePhoto", async () => {
    const r = await checkPhotoFile(fileOf(jpegOf(64, 64, { exif: "GPS-data" })));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.type).toBe("jpeg");
    expect(new TextDecoder("latin1").decode(r.bytes)).not.toContain("Exif");
    expect(validatePhoto(r.bytes).ok).toBe(true);
  });

  it("valid 64x64 and 512x512 PNG: ok, type png", async () => {
    for (const n of [64, 512]) {
      const r = await checkPhotoFile(fileOf(pngOf(n, n)));
      expect(r.ok && r.type).toBe("png");
    }
  });
});

describe("photoErrorMessage", () => {
  it("the 422 codes, image_changed and read_failed use the photo copy; image_not_supported says re-save or crop; others use apiCopy", () => {
    const e = portalCopy.profile.photo.errors;
    expect(photoErrorMessage("image_too_large")).toBe(e.image_too_large);
    expect(photoErrorMessage("image_bad_size")).toBe(e.image_bad_size);
    expect(photoErrorMessage("image_changed")).toBe(e.image_changed);
    expect(photoErrorMessage("read_failed")).toBe(e.read_failed);
    expect(photoErrorMessage("image_not_supported")).toMatch(/phone camera.*re-save or crop/);
    expect(photoErrorMessage("not_allowed")).toBe(apiCopy.errors.not_allowed);
    expect(photoErrorMessage("zzz")).toBe(apiCopy.errors.internal);
  });
});
