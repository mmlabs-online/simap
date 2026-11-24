import type { SpriteManifest } from "@/lib/sprites/types";
import { validateSpriteManifest } from "@/lib/validate/sprite-manifest";

export type Atlas = { manifest: SpriteManifest; image: HTMLImageElement };

export type LoadResult = { ok: true; atlas: Atlas } | { ok: false };

export type LoadDeps = {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  createImage: () => HTMLImageElement;
  signal?: AbortSignal;
};

const MANIFEST_URL = "/sprites/office.json";
const IMAGE_URL = "/sprites/office.png";

/** The `?v=` cache buster, only when the manifest names a string version. */
function imageUrl(json: unknown): string {
  const meta =
    typeof json === "object" && json !== null ? (json as { meta?: unknown }).meta : undefined;
  const version =
    typeof meta === "object" && meta !== null ? (meta as { version?: unknown }).version : undefined;
  return typeof version === "string" ? `${IMAGE_URL}?v=${encodeURIComponent(version)}` : IMAGE_URL;
}

function loadImage(deps: LoadDeps, url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = deps.createImage();
    const done = (value: HTMLImageElement | null) => {
      image.onload = null;
      image.onerror = null;
      deps.signal?.removeEventListener("abort", onAbort);
      resolve(value);
    };
    const onAbort = () => done(null);
    image.onload = () => done(image);
    image.onerror = () => done(null);
    deps.signal?.addEventListener("abort", onAbort);
    image.src = url;
  });
}

/** Loads the manifest, then the image, then validates both. Never throws: any failure is `{ ok: false }`. */
export async function loadAtlas(deps: LoadDeps): Promise<LoadResult> {
  try {
    const res = await deps.fetch(MANIFEST_URL, { cache: "no-cache", signal: deps.signal });
    if (!res.ok) return { ok: false };
    const json: unknown = await res.json();
    const image = await loadImage(deps, imageUrl(json));
    if (!image) return { ok: false };
    const checked = validateSpriteManifest(json, { w: image.naturalWidth, h: image.naturalHeight });
    return checked.ok ? { ok: true, atlas: { manifest: checked.value, image } } : { ok: false };
  } catch {
    return { ok: false };
  }
}
