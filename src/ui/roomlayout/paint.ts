import type { DrawList } from "@/lib/sprites/placement";
import { fitsCanvas } from "@/lib/sprites/zoom";
import type { Atlas } from "./loadAtlas";

const SHADOW_FILL = "rgba(32,42,58,.18)";

const tintCaches = new WeakMap<HTMLImageElement, Map<string, HTMLCanvasElement>>();

const defaultCanvas = () => document.createElement("canvas");

/** A grey frame recoloured with `hex` (multiply, then keep only the frame pixels). Cached per atlas. */
export function tintedFrame(
  atlas: Atlas,
  key: string,
  hex: string,
  createCanvas: () => HTMLCanvasElement = defaultCanvas,
): HTMLCanvasElement | null {
  const frame = atlas.manifest.frames[key];
  if (!frame) return null;
  let cache = tintCaches.get(atlas.image);
  if (!cache) {
    cache = new Map();
    tintCaches.set(atlas.image, cache);
  }
  const id = `${key}|${hex}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const out = createCanvas();
  out.width = frame.w;
  out.height = frame.h;
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(atlas.image, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, frame.w, frame.h);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(atlas.image, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
  ctx.globalCompositeOperation = "source-over";
  cache.set(id, out);
  return out;
}

/** Draws the list at an integer zoom. Returns false when the canvas is over the budget, did not take the size, or has no 2D context. */
export function paintRoom(
  canvas: HTMLCanvasElement,
  atlas: Atlas,
  list: DrawList,
  zoom: number,
  createCanvas: () => HTMLCanvasElement = defaultCanvas,
  images: (typeId: string, version: number) => CanvasImageSource | null = () => null,
): boolean {
  // Resizing resets the context state, so size first and set smoothing after.
  const w = list.bounds.w * zoom;
  const h = list.bounds.h * zoom;
  if (!fitsCanvas(w, h)) return false;
  canvas.width = w;
  canvas.height = h;
  if (canvas.width !== w || canvas.height !== h) return false;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  ctx.imageSmoothingEnabled = false;
  ctx.scale(zoom, zoom);
  ctx.translate(-list.bounds.x, -list.bounds.y);
  for (const op of list.ops) {
    if (op.type === "shadow") {
      ctx.fillStyle = SHADOW_FILL;
      ctx.fillRect(op.x, op.y, op.w, op.h);
      continue;
    }
    if (op.type === "image") {
      const src = images(op.typeId, op.version);
      if (src) ctx.drawImage(src, op.x, op.y, op.w, op.h);
      continue;
    }
    const frame = atlas.manifest.frames[op.key];
    if (!frame) continue;
    if (op.tint) {
      const tinted = tintedFrame(atlas, op.key, op.tint, createCanvas);
      if (tinted) ctx.drawImage(tinted, 0, 0, frame.w, frame.h, op.x, op.y, frame.w, frame.h);
    } else {
      ctx.drawImage(atlas.image, frame.x, frame.y, frame.w, frame.h, op.x, op.y, frame.w, frame.h);
    }
  }
  return true;
}
