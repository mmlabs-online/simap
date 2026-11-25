import { describe, expect, it, vi } from "vitest";
import { apiErrorMessage } from "../copy/api";
import { deviceTypesCopy } from "../copy/deviceTypes";
import { checkImageFile, imageCheckMessage, imageFieldView } from "./device-type-image";

const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  out.set(
    [...type].map((ch) => ch.charCodeAt(0)),
    4,
  );
  out.set(data, 8);
  v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
const join = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};
function png(w = 24, h = 24, padTo = 0) {
  const hdr = new Uint8Array(13);
  const v = new DataView(hdr.buffer);
  v.setUint32(0, w);
  v.setUint32(4, h);
  hdr.set([8, 6, 0, 0, 0], 8);
  const base = (pad: Uint8Array[]) =>
    join(
      new Uint8Array(SIG),
      chunk("IHDR", hdr),
      ...pad,
      chunk("IDAT", new Uint8Array([1, 2, 3])),
      chunk("IEND", new Uint8Array(0)),
    );
  if (!padTo) return base([]);
  const need = padTo - base([]).length - 12;
  return base([chunk("tEXt", new Uint8Array(need))]);
}
const fileOf = (bytes: Uint8Array, type = "image/png") => ({
  size: bytes.length,
  type,
  arrayBuffer: async () =>
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) as ArrayBuffer,
});

describe("checkImageFile", () => {
  it("valid 24 x 24 PNG is ok and returns the bytes", async () => {
    const b = png();
    const r = await checkImageFile(fileOf(b));
    expect(r.ok && Array.from(r.bytes)).toEqual(Array.from(b));
  });
  it("16 x 16 and 24 x 32 PNGs give image_bad_size", async () => {
    expect(await checkImageFile(fileOf(png(16, 16)))).toEqual({
      ok: false,
      code: "image_bad_size",
    });
    expect(await checkImageFile(fileOf(png(24, 32)))).toEqual({
      ok: false,
      code: "image_bad_size",
    });
  });
  it("size 20481 gives image_too_large and never calls arrayBuffer", async () => {
    const arrayBuffer = vi.fn();
    expect(await checkImageFile({ size: 20481, arrayBuffer })).toEqual({
      ok: false,
      code: "image_too_large",
    });
    expect(arrayBuffer).not.toHaveBeenCalled();
  });
  it("size 20480 valid PNG is ok", async () => {
    const b = png(24, 24, 20480);
    expect(b.length).toBe(20480);
    expect((await checkImageFile(fileOf(b))).ok).toBe(true);
  });
  it("text bytes, JPEG header and an empty file give image_not_png", async () => {
    const notPng = { ok: false, code: "image_not_png" };
    expect(
      await checkImageFile(fileOf(new TextEncoder().encode("hello world, not a png"))),
    ).toEqual(notPng);
    expect(
      await checkImageFile(fileOf(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0]))),
    ).toEqual(notPng);
    expect(await checkImageFile(fileOf(new Uint8Array(0)))).toEqual(notPng);
  });
  it("does not look at type or name", async () => {
    expect((await checkImageFile(fileOf(png(), "application/octet-stream"))).ok).toBe(true);
  });
  it("arrayBuffer that throws gives read_failed", async () => {
    const r = await checkImageFile({ size: 10, arrayBuffer: () => Promise.reject(new Error("x")) });
    expect(r).toEqual({ ok: false, code: "read_failed" });
  });
});

describe("imageCheckMessage", () => {
  it("server codes map through apiErrorMessage; read_failed maps to copy.readFailed", () => {
    expect(imageCheckMessage("image_bad_size")).toBe(apiErrorMessage("image_bad_size"));
    expect(imageCheckMessage("image_too_large")).toBe(apiErrorMessage("image_too_large"));
    expect(imageCheckMessage("read_failed")).toBe(deviceTypesCopy.form.readFailed);
  });
});

describe("imageFieldView", () => {
  const bytes = new Uint8Array(1);
  it("keep with current url", () => {
    expect(imageFieldView({ kind: "keep" }, true, "blob:c")).toEqual({
      previewUrl: "blob:c",
      state: "current",
      showRemove: true,
      showUndo: false,
    });
  });
  it("keep without image", () => {
    expect(imageFieldView({ kind: "keep" }, false, null)).toEqual({
      previewUrl: null,
      state: "none",
      showRemove: false,
      showUndo: false,
    });
  });
  it("replace shows the staged url", () => {
    expect(imageFieldView({ kind: "replace", bytes, url: "blob:s" }, false, null)).toEqual({
      previewUrl: "blob:s",
      state: "staged",
      showRemove: true,
      showUndo: false,
    });
  });
  it("remove shows no preview and the undo", () => {
    expect(imageFieldView({ kind: "remove" }, true, "blob:c")).toEqual({
      previewUrl: null,
      state: "remove",
      showRemove: false,
      showUndo: true,
    });
  });
});
