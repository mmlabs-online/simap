import "server-only";

export type ReadJson = { ok: true; body: unknown } | { ok: false };

/** Reads a small JSON body: the content type must be application/json, the size is capped, parse errors give `ok: false`. */
export async function readJson(req: Request, maxBytes = 16_384): Promise<ReadJson> {
  const type = req.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (type !== "application/json") return { ok: false };
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false };
  try {
    const text = await req.text();
    if (new TextEncoder().encode(text).length > maxBytes) return { ok: false };
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}
