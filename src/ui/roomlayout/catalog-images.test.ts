import { describe, expect, it, vi } from "vitest";
import type { SeatDevice, SeatDeviceType } from "@/lib/sprites/layout";
import { createCatalogImages } from "./catalog-images";

const type = (over: Partial<SeatDeviceType> = {}): SeatDeviceType => ({
  id: "t1",
  slot: "phone",
  hasImage: true,
  imageVersion: 1,
  ...over,
});
const devices = (...types: SeatDeviceType[]): Record<string, SeatDevice[]> => ({
  s1: types.map((deviceType) => ({ type: "x", deviceType })),
});
const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(opts: { blob?: Blob | null; decoded?: boolean } = {}) {
  const img = {} as CanvasImageSource;
  const load = vi.fn(async () => (opts.blob === undefined ? new Blob(["x"]) : opts.blob));
  const revoke = vi.fn();
  const onChange = vi.fn();
  const c = createCatalogImages({
    load,
    create: () => "blob:1",
    revoke,
    decode: async () => {
      if (opts.decoded === false) throw new Error("bad image");
      return img;
    },
    onChange,
  });
  return { c, img, load, revoke, onChange };
}

describe("createCatalogImages", () => {
  it("fetches once per type across devices, repeated syncs and a same-version reload", async () => {
    const { c, load, img } = setup();
    const t = type();
    c.sync(devices(t, t));
    c.sync(devices(t));
    await flush();
    c.sync({ s1: [{ type: "x", deviceType: { ...t } }] });
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    expect(c.ready(t)).toBe(true);
    expect(c.source("t1", 1)).toBe(img);
  });

  it("a bumped version fetches again and the new version is not ready until loaded", async () => {
    const { c, load } = setup();
    c.sync(devices(type()));
    await flush();
    c.sync(devices(type({ imageVersion: 2 })));
    expect(c.ready(type({ imageVersion: 2 }))).toBe(false);
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
    expect(c.ready(type({ imageVersion: 2 }))).toBe(true);
  });

  it("failed fetch and decode error report not ready", async () => {
    for (const opts of [{ blob: null }, { decoded: false }]) {
      const { c } = setup(opts);
      c.sync(devices(type()));
      await flush();
      expect(c.ready(type())).toBe(false);
      expect(c.source("t1", 1)).toBeNull();
    }
  });

  it("types without an image are not fetched", async () => {
    const { c, load } = setup();
    c.sync(devices(type({ hasImage: false })));
    await flush();
    expect(load).not.toHaveBeenCalled();
  });

  it("dispose revokes URLs and drops images", async () => {
    const { c, revoke } = setup();
    c.sync(devices(type()));
    await flush();
    c.dispose();
    expect(revoke).toHaveBeenCalledWith("blob:1");
    expect(c.ready(type())).toBe(false);
  });
});
