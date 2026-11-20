import "server-only";

export type ReadJson = { ok: true; body: unknown } | { ok: false };

/** Reads a small JSON body: the content type must be application/json, the size is capped while streaming, parse and UTF-8 errors give `ok: false`. */
export async function readJson(req: Request, maxBytes = 16_384): Promise<ReadJson> {
  const type = req.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (type !== "application/json") return { ok: false };
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false };
  if (!req.body) return { ok: false };
  const reader = req.body.getReader();
  try {
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        return { ok: false };
      }
      chunks.push(value);
    }
    const all = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) {
      all.set(c, at);
      at += c.byteLength;
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(all);
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch {
    await reader.cancel().catch(() => {});
    return { ok: false };
  }
}
