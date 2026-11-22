import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { loadAtlas } from "./loadAtlas";

const json = JSON.parse(
  readFileSync(new URL("../../../public/sprites/office.json", import.meta.url), "utf8"),
);

type FakeImage = {
  onload: (() => void) | null;
  onerror: (() => void) | null;
  naturalWidth: number;
  naturalHeight: number;
  src: string;
};

function makeImage(outcome: "load" | "error" | "hang" = "load") {
  const image: FakeImage = {
    onload: null,
    onerror: null,
    naturalWidth: 4096,
    naturalHeight: 4096,
    src: "",
  };
  const seen: string[] = [];
  Object.defineProperty(image, "src", {
    get: () => seen[seen.length - 1] ?? "",
    set: (v: string) => {
      seen.push(v);
      if (outcome === "hang") return;
      queueMicrotask(() => (outcome === "load" ? image.onload : image.onerror)?.());
    },
  });
  return { image: image as unknown as HTMLImageElement, raw: image, seen };
}

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("loadAtlas", () => {
  it("loads JSON first, then the image, then validates with natural size", async () => {
    const calls: string[] = [];
    const img = makeImage();
    const result = await loadAtlas({
      fetch: async (url, init) => {
        calls.push(`fetch ${url} ${init?.cache}`);
        return ok(json);
      },
      createImage: () => {
        calls.push("image");
        return img.image;
      },
    });
    expect(result.ok).toBe(true);
    expect(calls).toEqual(["fetch /sprites/office.json no-cache", "image"]);
    expect(img.seen[0]).toMatch(/^\/sprites\/office\.png\?v=/);
    // A too-small natural size makes the same manifest invalid.
    const small = makeImage();
    small.raw.naturalWidth = 8;
    expect(
      (await loadAtlas({ fetch: async () => ok(json), createImage: () => small.image })).ok,
    ).toBe(false);
  });

  it("adds ?v only for a string version, URL-encoded", async () => {
    const urlFor = async (meta: unknown) => {
      const img = makeImage();
      await loadAtlas({
        fetch: async () => ok({ ...json, meta }),
        createImage: () => img.image,
      });
      return img.seen[0];
    };
    expect(await urlFor({ version: "a b/c" })).toBe("/sprites/office.png?v=a%20b%2Fc");
    expect(await urlFor({ version: 5 })).toBe("/sprites/office.png");
    expect(await urlFor(undefined)).toBe("/sprites/office.png");
    expect(await urlFor(null)).toBe("/sprites/office.png");
  });

  it("404 returns ok false", async () => {
    const r = await loadAtlas({
      fetch: async () => new Response("", { status: 404 }),
      createImage: () => makeImage().image,
    });
    expect(r).toEqual({ ok: false });
  });

  it("bad JSON returns ok false", async () => {
    const r = await loadAtlas({
      fetch: async () => new Response("{nope", { status: 200 }),
      createImage: () => makeImage().image,
    });
    expect(r).toEqual({ ok: false });
  });

  it("failing validator returns ok false", async () => {
    const r = await loadAtlas({
      fetch: async () => ok({ tile: 16 }),
      createImage: () => makeImage().image,
    });
    expect(r).toEqual({ ok: false });
  });

  it("image error returns ok false", async () => {
    const r = await loadAtlas({
      fetch: async () => ok(json),
      createImage: () => makeImage("error").image,
    });
    expect(r).toEqual({ ok: false });
  });

  it("fetch rejects returns ok false", async () => {
    const r = await loadAtlas({
      fetch: async () => {
        throw new Error("offline");
      },
      createImage: () => makeImage().image,
    });
    expect(r).toEqual({ ok: false });
  });

  it("abort resolves without a state change and clears image handlers", async () => {
    const controller = new AbortController();
    const img = makeImage("hang");
    const removed = vi.spyOn(controller.signal, "removeEventListener");
    const pending = loadAtlas({
      fetch: async () => ok(json),
      createImage: () => img.image,
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(img.seen).toHaveLength(1));
    controller.abort();
    expect(await pending).toEqual({ ok: false });
    expect(img.raw.onload).toBeNull();
    expect(img.raw.onerror).toBeNull();
    expect(removed).toHaveBeenCalled();
  });
});
