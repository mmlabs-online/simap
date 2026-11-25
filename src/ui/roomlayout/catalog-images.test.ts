import { describe, expect, it, vi } from "vitest";
import type { SeatDevice, SeatDeviceType } from "@/lib/sprites/layout";
import type { ItemArtEntry } from "@/lib/sprites/item-art";
import { createCatalogImages } from "./catalog-images";

const type = (over: Partial<SeatDeviceType> = {}): SeatDeviceType => ({
  id: "t1",
  slot: "phone",
  hasImage: true,
  imageVersion: 1,
  sprite: null,
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

describe("createCatalogImages items", () => {
  const entry = (key: string, dir: ItemArtEntry["dir"], imageVersion = 1): ItemArtEntry => ({
    id: `item:${key}|${dir}`,
    key,
    dir,
    hasImage: true,
    imageVersion,
  });
  const sized = { naturalWidth: 32, naturalHeight: 64 } as unknown as CanvasImageSource;
  const setupItems = () => {
    const load = vi.fn(async (_id: string) => new Blob(["x"]));
    const revoke = vi.fn();
    let n = 0;
    const c = createCatalogImages({
      load,
      create: () => `blob:${++n}`,
      revoke,
      decode: async () => sized,
      onChange: () => {},
    });
    return { c, load, revoke };
  };

  it("loads once per key, direction and version; two directions load twice", async () => {
    const { c, load } = setupItems();
    c.sync({}, [entry("plant.large", "s"), entry("plant.large", "e")]);
    c.sync({}, [entry("plant.large", "s"), entry("plant.large", "e")]);
    await flush();
    expect(load.mock.calls.map((a) => a[0]).sort()).toEqual([
      "item:plant.large|e",
      "item:plant.large|s",
    ]);
  });

  it("a version bump revokes and reloads; a removed entry is revoked", async () => {
    const { c, load, revoke } = setupItems();
    c.sync({}, [entry("a", "s")]);
    await flush();
    c.sync({}, [entry("a", "s", 2)]);
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
    expect(revoke).toHaveBeenCalledWith("blob:1");
    c.sync({}, []);
    expect(revoke).toHaveBeenCalledWith("blob:2");
  });

  it("a failed load stays failed until the version changes", async () => {
    const load = vi.fn(async () => null);
    const c = createCatalogImages({
      load,
      create: () => "blob:1",
      revoke: () => {},
      decode: async () => sized,
      onChange: () => {},
    });
    c.sync({}, [entry("a", "s")]);
    await flush();
    c.sync({}, [entry("a", "s")]);
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    expect(c.itemSize("a", "s", 1)).toBeNull();
    c.sync({}, [entry("a", "s", 2)]);
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("devices and items share one cache; itemSize is the natural size for the matching version", async () => {
    const { c, load } = setupItems();
    c.sync(devices(type()), [entry("a", "s", 3)]);
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
    expect(c.ready(type())).toBe(true);
    expect(c.itemSize("a", "s", 3)).toEqual({ w: 32, h: 64 });
    expect(c.itemSize("a", "s", 2)).toBeNull();
    expect(c.itemSize("a", "n", 3)).toBeNull();
  });
});
