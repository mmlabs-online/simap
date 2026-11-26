import { describe, expect, it, vi } from "vitest";
import { jpegOf, pngOf } from "@/test/photo-fixtures";
import { PHOTO_INPUT_LIMITS } from "@/lib/photo-crop";
import { validatePhoto } from "@/lib/validate/photo";
import { apiCopy } from "../copy/api";
import { portalCopy } from "../copy/portal";
import type { PhotoConverter, PhotoSource } from "./photo-canvas";
import { photoErrorMessage, preparePhoto } from "./profile-photo";

const file = (size = 1000) => ({ size, arrayBuffer: vi.fn(async () => new ArrayBuffer(0)) });

function fake(width: number, height: number, out: Uint8Array | null, hasAlpha = false) {
  const encode = vi.fn(async () => out as Uint8Array<ArrayBuffer> | null);
  const render = vi.fn(async () => ({ hasAlpha, encode }));
  const close = vi.fn();
  const source: PhotoSource = { width, height, close, render };
  const decode = vi.fn(async () => source);
  return { converter: { decode } as PhotoConverter, decode, render, close, encode };
}

describe("preparePhoto", () => {
  it("input over 20 MB: image_too_big_to_process, decode not called", async () => {
    const f = fake(10, 10, null);
    const r = await preparePhoto(
      file(PHOTO_INPUT_LIMITS.maxBytes + 1) as unknown as Blob,
      f.converter,
    );
    expect(r).toEqual({ ok: false, code: "image_too_big_to_process" });
    expect(f.decode).not.toHaveBeenCalled();
  });

  it("decode returns null: read_failed; decode throws: read_failed", async () => {
    const none = { decode: async () => null } as PhotoConverter;
    expect(await preparePhoto(file() as unknown as Blob, none)).toEqual({
      ok: false,
      code: "read_failed",
    });
    const boom = {
      decode: async () => {
        throw new Error("x");
      },
    } as PhotoConverter;
    expect(await preparePhoto(file() as unknown as Blob, boom)).toEqual({
      ok: false,
      code: "read_failed",
    });
  });

  it("0x0 image: read_failed and close called", async () => {
    const f = fake(0, 0, null);
    expect(await preparePhoto(file() as unknown as Blob, f.converter)).toEqual({
      ok: false,
      code: "read_failed",
    });
    expect(f.close).toHaveBeenCalled();
  });

  it("60 MP image: image_too_big_to_process, close called, render not called", async () => {
    const f = fake(10000, 6000, null);
    expect(await preparePhoto(file() as unknown as Blob, f.converter)).toEqual({
      ok: false,
      code: "image_too_big_to_process",
    });
    expect(f.close).toHaveBeenCalled();
    expect(f.render).not.toHaveBeenCalled();
  });

  it("4032x3024: renders the centered square in halving steps and returns valid JPEG bytes", async () => {
    const f = fake(4032, 3024, jpegOf(512, 512));
    const input = file();
    const r = await preparePhoto(input as unknown as Blob, f.converter);
    expect(f.render).toHaveBeenCalledWith({ sx: 504, sy: 0, side: 3024 }, [1512, 756, 512]);
    expect(r.ok && r.type).toBe("jpeg");
    if (r.ok) expect(validatePhoto(r.bytes).ok).toBe(true);
    expect(f.close).toHaveBeenCalledTimes(1);
  });

  it("close is called when render throws, and the result is read_failed", async () => {
    const f = fake(100, 100, null);
    f.render.mockRejectedValueOnce(new Error("x"));
    expect(await preparePhoto(file() as unknown as Blob, f.converter)).toEqual({
      ok: false,
      code: "read_failed",
    });
    expect(f.close).toHaveBeenCalledTimes(1);
  });

  it("40x30 with alpha and a PNG encoder result: ok, type png", async () => {
    const f = fake(40, 30, pngOf(64, 64), true);
    const r = await preparePhoto(file() as unknown as Blob, f.converter);
    expect(f.render).toHaveBeenCalledWith({ sx: 5, sy: 0, side: 30 }, [64]);
    expect(r.ok && r.type).toBe("png");
  });

  it("encoder output that fails validatePhoto returns that code; the input bytes are never read", async () => {
    const f = fake(300, 300, pngOf(100, 80), true);
    const input = file();
    const r = await preparePhoto(input as unknown as Blob, f.converter);
    expect(r).toEqual({ ok: false, code: "image_bad_size" });
    expect(input.arrayBuffer).not.toHaveBeenCalled();
  });
});

describe("photoErrorMessage", () => {
  it("photo codes use the photo copy without limit numbers; others use apiCopy", () => {
    const e = portalCopy.profile.photo.errors;
    for (const code of [
      "image_too_big_to_process",
      "image_could_not_shrink",
      "read_failed",
      "image_changed",
      "image_too_large",
      "image_bad_size",
      "image_not_supported",
    ] as const) {
      expect(photoErrorMessage(code)).toBe(e[code]);
    }
    for (const text of Object.values(e)) expect(text).not.toMatch(/square|px|256 KB/);
    // the hint itself says the photo is cropped to a square (planned copy), but names no pixel or KB limit
    expect(portalCopy.profile.photo.hint).not.toMatch(/px|256 KB/);
    expect(e.image_too_big_to_process).toContain("20 MB");
    expect(photoErrorMessage("not_allowed")).toBe(apiCopy.errors.not_allowed);
    expect(photoErrorMessage("zzz")).toBe(apiCopy.errors.internal);
  });
});
