"use client";

import { useEffect, useState } from "react";
import { loadAtlas, type Atlas } from "./loadAtlas";

/** Loads `/sprites/office.png|json` once. `failed` is set for a bad atlas; the caller may also set it. */
export function useAtlas(): {
  atlas: Atlas | null;
  failed: boolean;
  setFailed: (failed: boolean) => void;
} {
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    loadAtlas({
      fetch: (url, init) => window.fetch(url, init),
      createImage: () => new Image(),
      signal: controller.signal,
    }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok) setAtlas(result.atlas);
      else setFailed(true);
    });
    return () => controller.abort();
  }, []);

  return { atlas, failed, setFailed };
}
