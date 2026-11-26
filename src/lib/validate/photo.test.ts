import { describe, expect, it } from "vitest";
import {
  EOI,
  SCAN,
  SOI,
  bytesOf,
  jpegOf,
  pngChunk,
  pngOf,
  seg,
  sofSeg,
} from "@/test/photo-fixtures";
import { PHOTO_LIMITS, parseJpeg, stripPhotoMetadata, validatePhoto } from "./photo";

const code = (b: Uint8Array) => {
  const r = validatePhoto(b);
  return r.ok ? "ok" : r.code;
};
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");
const text = (s: string) => new TextEncoder().encode(s);
const has = (b: Uint8Array, s: string) => Buffer.from(b).includes(Buffer.from(s));

describe("validatePhoto", () => {
  it("PNG 64, 256, 512 square ok, type png", () => {
    for (const n of [64, 256, 512]) {
      expect(validatePhoto(pngOf(n, n))).toEqual({ ok: true, type: "png", size: n });
    }
  });

  it("PNG 63x63, 513x513, 64x65 give image_bad_size", () => {
    for (const [w, h] of [
      [63, 63],
      [513, 513],
      [64, 65],
    ] as const) {
      expect(code(pngOf(w, h))).toBe("image_bad_size");
    }
  });

  it("JPEG baseline and progressive 64/512 ok; 63, 513 and non-square give image_bad_size", () => {
    for (const progressive of [false, true]) {
      for (const n of [64, 512]) {
        expect(validatePhoto(jpegOf(n, n, { progressive }))).toEqual({
          ok: true,
          type: "jpeg",
          size: n,
        });
      }
    }
    for (const [w, h] of [
      [63, 63],
      [513, 513],
      [64, 128],
    ] as const) {
      expect(code(jpegOf(w, h))).toBe("image_bad_size");
    }
  });

  it("APNG, GIF, WebP, BMP, SVG text, empty and 1 byte give image_not_supported", () => {
    const apng = pngOf(64, 64, { before: [pngChunk("acTL", new Uint8Array(8))] });
    const cases = [
      apng,
      text("GIF89a......"),
      text("RIFF\0\0\0\0WEBPVP8 "),
      text("BM......"),
      text('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      new Uint8Array(0),
      new Uint8Array([0xff]),
    ];
    for (const c of cases) expect(code(c)).toBe("image_not_supported");
  });

  it("JPEG structure: bad shapes give image_not_supported", () => {
    const ok = jpegOf(64, 64);
    const frame = [seg(0xdb, new Uint8Array(65)), sofSeg(64, 64)];
    const bad: Record<string, Uint8Array> = {
      "missing EOI": ok.subarray(0, ok.length - 2),
      "bytes after EOI": bytesOf([ok, text("<script>")]),
      "truncated segment": bytesOf([SOI, new Uint8Array([0xff, 0xdb, 0x00])]),
      "segment length 1": bytesOf([SOI, new Uint8Array([0xff, 0xdb, 0x00, 0x01]), EOI]),
      "segment past the end": bytesOf([SOI, new Uint8Array([0xff, 0xdb, 0x7f, 0xff, 1, 2]), EOI]),
      "two SOF": bytesOf([SOI, ...frame, sofSeg(64, 64), SCAN, EOI]),
      "SOF3 lossless": bytesOf([SOI, sofSeg(64, 64, 0xc3), SCAN, EOI]),
      "SOF9 arithmetic": bytesOf([SOI, sofSeg(64, 64, 0xc9), SCAN, EOI]),
      "SOS before SOF": bytesOf([SOI, SCAN, ...frame, EOI]),
      "nested SOI": bytesOf([SOI, SOI, ...frame, SCAN, EOI]),
      "height 0": bytesOf([SOI, sofSeg(64, 0), SCAN, EOI]),
      "no scan": bytesOf([SOI, ...frame, EOI]),
      "bad component count": bytesOf([SOI, sofSeg(64, 64, 0xc0, 2), SCAN, EOI]),
      "stray RST outside scan": bytesOf([SOI, new Uint8Array([0xff, 0xd0]), ...frame, SCAN, EOI]),
    };
    for (const [name, b] of Object.entries(bad))
      expect([name, code(b)]).toEqual([name, "image_not_supported"]);
  });

  it("JPEG scan data with FF00 stuffing, RST markers and fill bytes parses", () => {
    expect(parseJpeg(jpegOf(64, 64))).toEqual({ ok: true, width: 64, height: 64 });
    const filled = bytesOf([
      SOI,
      seg(0xdb, new Uint8Array(65)),
      new Uint8Array([0xff, 0xff, 0xff]),
      sofSeg(64, 64),
      SCAN,
      new Uint8Array([0xff, 0xff]),
      EOI,
    ]);
    expect(validatePhoto(filled)).toEqual({ ok: true, type: "jpeg", size: 64 });
  });

  it("262144 bytes ok; 262145 gives image_too_large before parsing", () => {
    expect(validatePhoto(pngOf(64, 64, { padTo: PHOTO_LIMITS.maxBytes })).ok).toBe(true);
    expect(validatePhoto(jpegOf(64, 64, { padTo: PHOTO_LIMITS.maxBytes })).ok).toBe(true);
    expect(code(new Uint8Array(PHOTO_LIMITS.maxBytes + 1))).toBe("image_too_large");
  });

  it("the magic bytes decide the type", () => {
    const r = validatePhoto(jpegOf(64, 64));
    expect(r.ok && r.type).toBe("jpeg");
  });
});

describe("stripPhotoMetadata", () => {
  it("JPEG: APP1, APP13 and COM removed, the rest byte-identical", () => {
    const meta = jpegOf(64, 64, { app0: true, exif: "GPS 10.8N", iptc: true, com: "camera" });
    const plain = jpegOf(64, 64, { app0: true });
    expect(has(meta, "GPS")).toBe(true);
    const out = stripPhotoMetadata(meta, "jpeg");
    expect(hex(out)).toBe(hex(plain));
    expect(validatePhoto(out)).toEqual({ ok: true, type: "jpeg", size: 64 });
  });

  it("JPEG: nothing to strip gives identical bytes", () => {
    const b = jpegOf(128, 128, { app0: true, progressive: true });
    expect(hex(stripPhotoMetadata(b, "jpeg"))).toBe(hex(b));
  });

  it("PNG: eXIf, tEXt, zTXt, iTXt and tIME removed, the rest byte-identical", () => {
    const keep = pngChunk("pHYs", new Uint8Array(9));
    const meta = pngOf(64, 64, {
      before: [
        pngChunk("eXIf", text("GPS")),
        pngChunk("tEXt", text("Comment\0hi")),
        pngChunk("zTXt", new Uint8Array(4)),
        pngChunk("iTXt", new Uint8Array(4)),
        pngChunk("tIME", new Uint8Array(7)),
        keep,
      ],
    });
    const out = stripPhotoMetadata(meta, "png");
    expect(hex(out)).toBe(hex(pngOf(64, 64, { before: [keep] })));
    expect(validatePhoto(out)).toEqual({ ok: true, type: "png", size: 64 });
  });

  it("Vietnamese text in a tEXt or COM payload is stripped and does not break parsing", () => {
    const name = "Nguyễn Văn Ân";
    const j = stripPhotoMetadata(jpegOf(64, 64, { com: name }), "jpeg");
    expect(has(j, "Nguy")).toBe(false);
    expect(validatePhoto(j).ok).toBe(true);
    const p = stripPhotoMetadata(
      pngOf(64, 64, { before: [pngChunk("tEXt", text(`Author\0${name}`))] }),
      "png",
    );
    expect(has(p, "Nguy")).toBe(false);
    expect(validatePhoto(p).ok).toBe(true);
  });
});
