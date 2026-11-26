import type { SquareRect } from "@/lib/photo-crop";
import type { PhotoType } from "@/lib/validate/photo";

export type RenderedPhoto = {
  hasAlpha: boolean;
  encode(type: PhotoType, quality?: number): Promise<Uint8Array<ArrayBuffer> | null>;
};

export type PhotoSource = {
  width: number;
  height: number;
  close(): void;
  render(rect: SquareRect, steps: number[]): Promise<RenderedPhoto | null>;
};

export type PhotoConverter = { decode(file: Blob): Promise<PhotoSource | null> };

type Canvas = OffscreenCanvas | HTMLCanvasElement;
type Ctx = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
type Drawable = CanvasImageSource;

function makeCanvas(side: number): Canvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(side, side);
  const c = document.createElement("canvas");
  c.width = side;
  c.height = side;
  return c;
}

function context(c: Canvas): Ctx | null {
  const ctx = c.getContext("2d") as Ctx | null;
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  }
  return ctx;
}

async function toBytes(c: Canvas, type: string, quality?: number) {
  const blob =
    "convertToBlob" in c
      ? await c.convertToBlob({ type, quality })
      : await new Promise<Blob | null>((r) => c.toBlob(r, type, quality));
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
}

function hasTransparency(ctx: Ctx, side: number): boolean {
  const data = ctx.getImageData(0, 0, side, side).data;
  for (let i = 3; i < data.length; i += 4) if (data[i]! < 255) return true;
  return false;
}

function sourceOf(image: Drawable, width: number, height: number, close: () => void): PhotoSource {
  return {
    width,
    height,
    close,
    async render({ sx, sy, side }, steps) {
      let current: Canvas | null = null;
      for (const s of steps) {
        const next = makeCanvas(s);
        const ctx = context(next);
        if (!ctx) return null;
        if (current) ctx.drawImage(current, 0, 0, current.width, current.height, 0, 0, s, s);
        else ctx.drawImage(image, sx, sy, side, side, 0, 0, s, s);
        current = next;
      }
      const final = current;
      const finalCtx = final && context(final);
      if (!final || !finalCtx) return null;
      const hasAlpha = hasTransparency(finalCtx, final.width);
      return {
        hasAlpha,
        async encode(type, quality) {
          if (type === "png") return toBytes(final, "image/png");
          if (!hasAlpha) return toBytes(final, "image/jpeg", quality);
          // JPEG has no alpha: put the image on white first
          const flat = makeCanvas(final.width);
          const flatCtx = context(flat);
          if (!flatCtx) return null;
          flatCtx.fillStyle = "#ffffff";
          flatCtx.fillRect(0, 0, final.width, final.width);
          flatCtx.drawImage(final, 0, 0);
          return toBytes(flat, "image/jpeg", quality);
        },
      };
    },
  };
}

async function viaBitmap(file: Blob): Promise<PhotoSource | null> {
  try {
    // EXIF orientation is applied here (the only rotation mechanism; never rotate by hand)
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    return sourceOf(bmp, bmp.width, bmp.height, () => bmp.close());
  } catch {
    return null;
  }
}

async function viaImage(file: Blob): Promise<PhotoSource | null> {
  const url = URL.createObjectURL(file);
  try {
    // the <img> path applies EXIF orientation by default (image-orientation: from-image)
    const img = new Image();
    img.src = url;
    await img.decode();
    return sourceOf(img, img.naturalWidth, img.naturalHeight, () => {});
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Browser adapter: decodes a picked file and draws a centered square. Only canvas-encoded bytes ever leave it. */
export const canvasConverter: PhotoConverter = {
  async decode(file) {
    // let the "Processing..." label paint before the heavy work
    await new Promise((r) => setTimeout(r, 0));
    return (await viaBitmap(file)) ?? (await viaImage(file));
  },
};
