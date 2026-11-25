import { describe, expect, it, vi } from "vitest";
import { apiErrorMessage } from "../copy/api";
import { mapItemErrorMessage } from "./map-items-state";
import { artErrorMessage, artOutcome, checkMapItemImage } from "./map-item-image";
import { dto } from "./test-items";

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
function png(w = 64, h = 64, padTo = 0) {
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
const fileOf = (bytes: Uint8Array) => ({
  size: bytes.length,
  arrayBuffer: async () =>
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) as ArrayBuffer,
});
const table = dto("table.meeting"); // 3 x 2: n needs 96 x 64..96
const floor = dto("floor.wood");

describe("checkMapItemImage", () => {
  it("over 64 KB is image_too_large without reading the file", async () => {
    const arrayBuffer = vi.fn();
    const r = await checkMapItemImage({ size: 65537, arrayBuffer }, table, "n");
    expect(r).toEqual({ ok: false, code: "image_too_large" });
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it("a read failure is read_failed; non-PNG and APNG are image_not_png", async () => {
    const bad = { size: 10, arrayBuffer: async () => Promise.reject(new Error("x")) };
    expect(await checkMapItemImage(bad, table, "n")).toEqual({ ok: false, code: "read_failed" });
    expect(await checkMapItemImage(fileOf(new Uint8Array(20)), table, "n")).toEqual({
      ok: false,
      code: "image_not_png",
    });
    const apng = png(96, 64);
    const withActl = join(
      apng.subarray(0, 33),
      chunk("acTL", new Uint8Array(8)),
      apng.subarray(33),
    );
    expect(await checkMapItemImage(fileOf(withActl), table, "n")).toEqual({
      ok: false,
      code: "image_not_png",
    });
  });

  it("wrong size is image_bad_size with the actual px; exact size and +32 overhang pass; floor 32x33 fails", async () => {
    expect(await checkMapItemImage(fileOf(png(40, 40)), table, "n")).toEqual({
      ok: false,
      code: "image_bad_size",
      px: { width: 40, height: 40 },
    });
    expect((await checkMapItemImage(fileOf(png(96, 64)), table, "n")).ok).toBe(true);
    expect((await checkMapItemImage(fileOf(png(96, 96)), table, "n")).ok).toBe(true);
    expect((await checkMapItemImage(fileOf(png(96, 97)), table, "n")).ok).toBe(false);
    expect((await checkMapItemImage(fileOf(png(96, 64)), table, "e")).ok).toBe(false);
    expect((await checkMapItemImage(fileOf(png(32, 32)), floor, "s")).ok).toBe(true);
    expect((await checkMapItemImage(fileOf(png(32, 33)), floor, "s")).ok).toBe(false);
  });
});

describe("artErrorMessage", () => {
  it("image_too_large names 64 KB, image_bad_size names the direction's expected size (and the actual px when known); both differ from apiErrorMessage", () => {
    expect(artErrorMessage("image_too_large", table, "n")).toContain("64 KB");
    expect(artErrorMessage("image_too_large", table, "n")).not.toBe(
      apiErrorMessage("image_too_large"),
    );
    const m = artErrorMessage("image_bad_size", table, "e", { width: 40, height: 40 });
    expect(m).toContain("40 × 40 px");
    expect(m).toContain("East needs 64 × 96 px, up to 64 × 128 px");
    expect(m).not.toBe(apiErrorMessage("image_bad_size"));
    expect(artErrorMessage("image_bad_size", table, "n")).not.toContain("This image is");
    expect(artErrorMessage("image_bad_size", floor, "s")).toContain("exactly 32 × 32 px");
    expect(m).not.toContain("24");
  });

  it("a non-directional item's image_bad_size message says Art, not South", () => {
    const m = artErrorMessage("image_bad_size", dto("plant.large"), "s", { width: 5, height: 5 });
    expect(m).toContain("Art needs");
    expect(m).not.toContain("South");
  });

  it("other codes fall back to mapItemErrorMessage (sprite_not_allowed, images_unavailable, drive_error, unauthenticated)", () => {
    for (const c of [
      "sprite_not_allowed",
      "images_unavailable",
      "drive_error",
      "unauthenticated",
    ]) {
      expect(artErrorMessage(c, table, "n")).toBe(mapItemErrorMessage(c));
    }
  });
});

describe("artOutcome", () => {
  it("ok -> saved; image_changed -> reload with message; not_found -> gone; anything else -> error", () => {
    expect(artOutcome({ ok: true, value: null }, table, "n")).toEqual({ kind: "saved" });
    expect(artOutcome({ ok: false, code: "image_changed" }, table, "n")).toEqual({
      kind: "reload",
      message: artErrorMessage("image_changed", table, "n"),
    });
    expect(artOutcome({ ok: false, code: "not_found" }, table, "n")).toEqual({ kind: "gone" });
    expect(artOutcome({ ok: false, code: "drive_error" }, table, "n")).toEqual({
      kind: "error",
      message: mapItemErrorMessage("drive_error"),
    });
  });
});
