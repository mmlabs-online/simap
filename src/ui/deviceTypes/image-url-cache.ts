/** Anything with a cached image: a device type (id = type id) or a map item direction (id = `itemImageId`). */
export type ImageEntry = { id: string; hasImage: boolean; imageVersion: number };

type Entry =
  | { version: number; state: "loading" }
  | { version: number; state: "ready"; url: string }
  | { version: number; state: "failed" };

type Options = {
  load: (id: string) => Promise<Blob | null>;
  create: (blob: Blob) => string;
  revoke: (url: string) => void;
  limit?: number;
  onChange?: () => void;
};

/** Blob URLs of catalog images, one entry per id, keyed by `{id, imageVersion}`. No React, no globals. */
export function createImageUrlCache({ load, create, revoke, limit = 4, onChange }: Options) {
  const entries = new Map<string, Entry>();
  const queue: { id: string; version: number }[] = [];
  let inFlight = 0;
  let disposed = false;

  function drop(id: string) {
    const e = entries.get(id);
    if (e?.state === "ready") revoke(e.url);
    entries.delete(id);
  }

  function pump() {
    while (!disposed && inFlight < limit && queue.length > 0) {
      const job = queue.shift()!;
      const cur = entries.get(job.id);
      if (!cur || cur.version !== job.version || cur.state !== "loading") continue;
      inFlight++;
      load(job.id)
        .catch(() => null)
        .then((blob) => {
          inFlight--;
          const now = entries.get(job.id);
          // A result for a disposed cache or a superseded version is dropped before any URL is created.
          if (disposed || !now || now.version !== job.version) {
            // dropped
          } else if (blob) {
            entries.set(job.id, { version: job.version, state: "ready", url: create(blob) });
            onChange?.();
          } else {
            entries.set(job.id, { version: job.version, state: "failed" });
            onChange?.();
          }
          pump();
        });
    }
  }

  return {
    sync(types: readonly ImageEntry[]) {
      if (disposed) return;
      const ids = new Set(types.map((t) => t.id));
      for (const id of [...entries.keys()]) if (!ids.has(id)) drop(id);
      for (const t of types) {
        const cur = entries.get(t.id);
        if (!t.hasImage) {
          if (cur) drop(t.id);
          continue;
        }
        if (cur && cur.version === t.imageVersion) continue;
        drop(t.id);
        entries.set(t.id, { version: t.imageVersion, state: "loading" });
        queue.push({ id: t.id, version: t.imageVersion });
      }
      pump();
    },
    url(t: ImageEntry): string | null {
      if (!t.hasImage) return null;
      const e = entries.get(t.id);
      return e && e.version === t.imageVersion && e.state === "ready" ? e.url : null;
    },
    dispose() {
      disposed = true;
      for (const id of [...entries.keys()]) drop(id);
      queue.length = 0;
    },
  };
}

export type ImageUrlCache = ReturnType<typeof createImageUrlCache>;
