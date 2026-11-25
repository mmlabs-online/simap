import { describe, expect, it, vi } from "vitest";
import type { DeviceTypeDto } from "@/lib/device-types/types";
import { createImageUrlCache } from "./image-url-cache";

const t = (id: string, version = 1, hasImage = true): DeviceTypeDto => ({
  id,
  name: id,
  slot: "pc",
  hasImage,
  imageVersion: version,
  sprite: null,
});
const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(limit?: number) {
  const pending: { id: string; resolve: (b: Blob | null) => void; reject: (e: unknown) => void }[] =
    [];
  const load = vi.fn(
    (id: string) =>
      new Promise<Blob | null>((resolve, reject) => pending.push({ id, resolve, reject })),
  );
  let n = 0;
  const create = vi.fn(() => `blob:${++n}`);
  const revoke = vi.fn();
  const onChange = vi.fn();
  const cache = createImageUrlCache({ load, create, revoke, onChange, limit });
  return { cache, pending, load, create, revoke, onChange };
}
const blob = new Blob(["x"]);

describe("createImageUrlCache", () => {
  it("hasImage false gives null and no load", () => {
    const s = setup();
    s.cache.sync([t("a", 0, false)]);
    expect(s.cache.url(t("a", 0, false))).toBeNull();
    expect(s.load).not.toHaveBeenCalled();
  });
  it("same id and version loads once, url available after load, onChange called", async () => {
    const s = setup();
    s.cache.sync([t("a")]);
    s.cache.sync([t("a")]);
    expect(s.load).toHaveBeenCalledTimes(1);
    expect(s.cache.url(t("a"))).toBeNull();
    s.pending[0].resolve(blob);
    await flush();
    expect(s.cache.url(t("a"))).toBe("blob:1");
    expect(s.onChange).toHaveBeenCalledTimes(1);
  });
  it("a new imageVersion revokes the old url and loads the new one", async () => {
    const s = setup();
    s.cache.sync([t("a", 1)]);
    s.pending[0].resolve(blob);
    await flush();
    s.cache.sync([t("a", 2)]);
    expect(s.revoke).toHaveBeenCalledWith("blob:1");
    expect(s.cache.url(t("a", 2))).toBeNull();
    s.pending[1].resolve(blob);
    await flush();
    expect(s.cache.url(t("a", 2))).toBe("blob:2");
  });
  it("an id missing from sync is revoked and dropped", async () => {
    const s = setup();
    s.cache.sync([t("a")]);
    s.pending[0].resolve(blob);
    await flush();
    s.cache.sync([]);
    expect(s.revoke).toHaveBeenCalledWith("blob:1");
    expect(s.cache.url(t("a"))).toBeNull();
  });
  it("dispose revokes every url", async () => {
    const s = setup();
    s.cache.sync([t("a"), t("b")]);
    s.pending[0].resolve(blob);
    s.pending[1].resolve(blob);
    await flush();
    s.cache.dispose();
    expect(s.revoke).toHaveBeenCalledTimes(2);
  });
  it("a load that resolves after dispose or after supersede creates no url", async () => {
    const s = setup();
    s.cache.sync([t("a", 1)]);
    s.cache.sync([t("a", 2)]);
    s.pending[0].resolve(blob);
    await flush();
    expect(s.create).not.toHaveBeenCalled();
    s.cache.dispose();
    s.pending[1].resolve(blob);
    await flush();
    expect(s.create).not.toHaveBeenCalled();
  });
  it("never more than 4 loads in flight; the queue drains", async () => {
    const s = setup();
    const types = Array.from({ length: 10 }, (_, i) => t(`t${i}`));
    s.cache.sync(types);
    expect(s.load).toHaveBeenCalledTimes(4);
    for (let i = 0; i < 10; i++) {
      s.pending[i].resolve(blob);
      await flush();
      expect(s.load.mock.calls.length - (i + 1)).toBeLessThanOrEqual(4);
    }
    expect(s.load).toHaveBeenCalledTimes(10);
    expect(types.every((x) => s.cache.url(x))).toBe(true);
  });
  it("a failed load gives null, is not retried for the same version, is retried on a new version", async () => {
    const s = setup();
    s.cache.sync([t("a"), t("b")]);
    s.pending[0].resolve(null);
    s.pending[1].reject(new Error("x"));
    await flush();
    s.cache.sync([t("a"), t("b")]);
    expect(s.load).toHaveBeenCalledTimes(2);
    expect(s.cache.url(t("a"))).toBeNull();
    s.cache.sync([t("a", 2)]);
    expect(s.load).toHaveBeenCalledTimes(3);
  });
});
