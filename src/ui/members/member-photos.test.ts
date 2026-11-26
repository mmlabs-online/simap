import { describe, expect, it, vi } from "vitest";
import { createImageUrlCache } from "../deviceTypes/image-url-cache";
import { photoLoader, removePhotoOutcome, toImageEntry, type PhotoRef } from "./member-photos";

const ref = (id: string, hasPhoto = true, photoVersion = 1): PhotoRef => ({
  id,
  hasPhoto,
  photoVersion,
});
const flush = () => new Promise((r) => setTimeout(r, 0));
const blob = new Blob(["x"]);

describe("member-photos", () => {
  it("toImageEntry maps hasPhoto/photoVersion", () => {
    expect(toImageEntry(ref("a", true, 3))).toEqual({
      id: "a",
      hasImage: true,
      imageVersion: 3,
    });
  });

  it("photoLoader: api ok -> blob; api error -> null", async () => {
    const ok = photoLoader({ getPhoto: async () => ({ ok: true, value: blob }) });
    expect(await ok("a")).toBe(blob);
    const bad = photoLoader({ getPhoto: async () => ({ ok: false, code: "not_found" }) });
    expect(await bad("a")).toBeNull();
  });

  it("cache: no photo -> null url and no load; ready -> blob url; failed load -> null (initials); version bump reloads and revokes the old url", async () => {
    let fail = false;
    const getPhoto = vi.fn(async (_id: string) =>
      fail ? { ok: false as const, code: "internal" } : { ok: true as const, value: blob },
    );
    let n = 0;
    const revoke = vi.fn();
    const cache = createImageUrlCache({
      load: photoLoader({ getPhoto }),
      create: () => `blob:${++n}`,
      revoke,
    });
    const none = ref("n", false, 0);
    cache.sync([toImageEntry(none)]);
    expect(cache.url(toImageEntry(none))).toBeNull();
    expect(getPhoto).not.toHaveBeenCalled();

    const a = ref("a");
    cache.sync([toImageEntry(a)]);
    await flush();
    expect(cache.url(toImageEntry(a))).toBe("blob:1");

    const a2 = ref("a", true, 2);
    cache.sync([toImageEntry(a2)]);
    await flush();
    expect(revoke).toHaveBeenCalledWith("blob:1");
    expect(cache.url(toImageEntry(a2))).toBe("blob:2");

    fail = true;
    const b = ref("b");
    cache.sync([toImageEntry(b)]);
    await flush();
    expect(cache.url(toImageEntry(b))).toBeNull();
    cache.dispose();
  });

  it("removePhotoOutcome: ok -> removed; not_found -> removed; forbidden / unavailable -> error with code", () => {
    expect(removePhotoOutcome({ ok: true, value: null })).toEqual({ kind: "removed" });
    expect(removePhotoOutcome({ ok: false, code: "not_found" })).toEqual({ kind: "removed" });
    for (const code of ["forbidden", "unavailable"]) {
      expect(removePhotoOutcome({ ok: false, code })).toEqual({ kind: "error", code });
    }
  });
});
