"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useApiFetch } from "../auth/api-fetch-context";
import { useSession } from "../session";
import { createRequestsApi } from "./requests-api";

type Badge = { count: number; set: (n: number) => void; seq: { current: number } };

const BadgeContext = createContext<Badge | null>(null);

/**
 * Holds the "newly decided requests" count. `set` bumps a sequence number first, so a fetch that started
 * earlier can never overwrite a newer value.
 */
export function RequestBadgeProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const seq = useRef(0);
  const set = useCallback((n: number) => {
    seq.current += 1;
    setCount(n);
  }, []);
  const value = useMemo(() => ({ count, set, seq }), [count, set]);
  return <BadgeContext.Provider value={value}>{children}</BadgeContext.Provider>;
}

/** The page's way to update the badge at once (a no-op outside the provider). */
export function useSetRequestBadge(): (n: number) => void {
  return useContext(BadgeContext)?.set ?? noop;
}

const noop = () => {};

/**
 * The badge count for the shell. Refreshes on mount, on a route change, on window focus and when the tab
 * becomes visible. No polling (D24). A failed refresh keeps the last count.
 */
export function useRequestBadge(pathname: string): number {
  const ctx = useContext(BadgeContext);
  const apiFetch = useApiFetch();
  const api = useMemo(() => createRequestsApi(apiFetch), [apiFetch]);
  const signedIn = useSession() !== null;
  const mounted = useRef(true);
  const seq = ctx?.seq;
  const set = ctx?.set;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!seq || !set || !signedIn) return;
    const mine = ++seq.current;
    const r = await api.mine(undefined, 1);
    if (!mounted.current || !r.ok || seq.current !== mine) return;
    set(r.value.unseen);
  }, [api, seq, set, signedIn]);

  useEffect(() => {
    void refresh();
  }, [refresh, pathname]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return ctx?.count ?? 0;
}
