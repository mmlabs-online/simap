"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { attachLeaveGuard, leaveDecision } from "./leave-guard";

/**
 * Guards leaving while `dirty`. `pending` is the href waiting for the user's answer. `leave` removes the
 * guard before navigating, so the guard does not catch its own navigation.
 */
export function useLeaveGuard(dirty: boolean) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const detach = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const off = attachLeaveGuard(window, document, setPending);
    detach.current = off;
    return () => {
      off();
      detach.current = null;
    };
  }, [dirty]);

  const request = useCallback(
    (href: string) => {
      if (leaveDecision(dirty) === "go") router.push(href);
      else setPending(href);
    },
    [dirty, router],
  );
  const leave = useCallback(() => {
    detach.current?.();
    if (pending !== null) router.push(pending);
    setPending(null);
  }, [pending, router]);
  const stay = useCallback(() => setPending(null), []);

  return { pending, request, leave, stay };
}
