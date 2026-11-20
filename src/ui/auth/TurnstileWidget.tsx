"use client";

import { useEffect, useRef } from "react";
import { authCopy } from "../copy/auth";
import { loadTurnstile, type TurnstileApi } from "./turnstile";

/**
 * Renders the Turnstile challenge into a slot. The token is single-use: the caller changes `resetKey` after each
 * submit to get a fresh challenge. Renders nothing without a site key.
 */
export function TurnstileWidget({
  siteKey,
  resetKey = 0,
  onToken,
  onExpire,
  onError,
}: {
  siteKey: string;
  resetKey?: number;
  onToken: (token: string) => void;
  onExpire: () => void;
  /** Script failed to load, the challenge errored, or no site key is configured. */
  onError: () => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const cb = useRef({ onToken, onExpire, onError });
  cb.current = { onToken, onExpire, onError };

  useEffect(() => {
    if (!siteKey) {
      cb.current.onError();
      return;
    }
    let cancelled = false;
    let rendered: { api: TurnstileApi; id: string } | null = null;
    loadTurnstile().then(
      (t) => {
        if (cancelled || !el.current) return;
        const id = t.render(el.current, {
          sitekey: siteKey,
          size: "flexible",
          theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
          callback: (token) => cb.current.onToken(token),
          "expired-callback": () => cb.current.onExpire(),
          "error-callback": () => cb.current.onError(),
        });
        rendered = { api: t, id };
      },
      () => {
        if (!cancelled) cb.current.onError();
      },
    );
    return () => {
      cancelled = true;
      rendered?.api.remove(rendered.id);
      rendered = null;
    };
  }, [siteKey, resetKey]);

  if (!siteKey) return null;
  return <div ref={el} role="group" aria-label={authCopy.turnstileLabel} />;
}
