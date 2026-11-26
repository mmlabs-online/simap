import "server-only";

export type ReadBytes =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: "type" | "too_large" | "empty" | "read" };

/**
 * Reads a small raw body: the media type must be exactly `type` (or one of the listed types) (lowercased, parameters ignored), a declared
 * `content-length` over the cap is refused without reading, and the size is capped again while streaming.
 */
export async function readBytes(
  req: Request,
  maxBytes: number,
  type: string | readonly string[],
): Promise<ReadBytes> {
  const got = req.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (got === undefined || !([] as readonly string[]).concat(type).includes(got))
    return { ok: false, reason: "type" };
  const header = req.headers.get("content-length");
  if (header !== null && Number.isFinite(Number(header)) && Number(header) > maxBytes) {
    return { ok: false, reason: "too_large" };
  }
  if (!req.body) return { ok: false, reason: "empty" };
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
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
    if (total === 0) return { ok: false, reason: "empty" };
    const all = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) {
      all.set(c, at);
      at += c.byteLength;
    }
    return { ok: true, bytes: all };
  } catch {
    await reader.cancel().catch(() => {});
    return { ok: false, reason: "read" };
  }
}
