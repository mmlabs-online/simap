import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { decodePng, encodePng, readPngSize } from "./png.mjs";

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Fixtures skip the CRC; the decoder does not verify it.
function chunk(name: string, body: Buffer) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(name, 4, "latin1");
  return Buffer.concat([head, body, Buffer.alloc(4)]);
}

function fixture(opts: {
  w: number;
  h: number;
  depth: number;
  type: number;
  rows: number[][];
  interlace?: number;
  plte?: number[];
  trns?: number[];
}) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(opts.w, 0);
  ihdr.writeUInt32BE(opts.h, 4);
  ihdr[8] = opts.depth;
  ihdr[9] = opts.type;
  ihdr[12] = opts.interlace ?? 0;
  const raw = Buffer.from(opts.rows.flatMap((r) => [0, ...r]));
  return Buffer.concat([
    SIG,
    chunk("IHDR", ihdr),
    ...(opts.plte ? [chunk("PLTE", Buffer.from(opts.plte))] : []),
    ...(opts.trns ? [chunk("tRNS", Buffer.from(opts.trns))] : []),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

describe("png codec", () => {
  it("RGBA round-trip is lossless", () => {
    const data = new Uint8Array(3 * 2 * 4).map((_, i) => (i * 37) % 256);
    const out = decodePng(encodePng({ w: 3, h: 2, data }));
    expect([out.w, out.h]).toEqual([3, 2]);
    expect([...out.data]).toEqual([...data]);
  });

  it("decodes a palette PNG with tRNS (1-bit and 8-bit)", () => {
    const plte = [10, 20, 30, 40, 50, 60];
    const one = decodePng(
      fixture({ w: 2, h: 1, depth: 1, type: 3, rows: [[0b01000000]], plte, trns: [0] }),
    );
    expect([...one.data]).toEqual([10, 20, 30, 0, 40, 50, 60, 255]);
    const eight = decodePng(
      fixture({ w: 2, h: 1, depth: 8, type: 3, rows: [[1, 0]], plte, trns: [128] }),
    );
    expect([...eight.data]).toEqual([40, 50, 60, 255, 10, 20, 30, 128]);
  });

  it("decodes grey+alpha and RGB", () => {
    const ga = decodePng(fixture({ w: 1, h: 1, depth: 8, type: 4, rows: [[7, 9]] }));
    expect([...ga.data]).toEqual([7, 7, 7, 9]);
    const rgb = decodePng(fixture({ w: 1, h: 1, depth: 8, type: 2, rows: [[1, 2, 3]] }));
    expect([...rgb.data]).toEqual([1, 2, 3, 255]);
  });

  it("throws Unsupported PNG on interlaced or 16-bit input", () => {
    const rows = [[0, 0, 0, 0]];
    expect(() => decodePng(fixture({ w: 1, h: 1, depth: 8, type: 6, rows, interlace: 1 }))).toThrow(
      /Unsupported PNG/,
    );
    const wide = [new Array(8).fill(0)];
    expect(() => decodePng(fixture({ w: 1, h: 1, depth: 16, type: 6, rows: wide }))).toThrow(
      /Unsupported PNG/,
    );
  });

  it("readPngSize reads the IHDR", () => {
    const png = encodePng({ w: 5, h: 7, data: new Uint8Array(5 * 7 * 4) });
    expect(readPngSize(png)).toEqual({ w: 5, h: 7 });
  });
});
