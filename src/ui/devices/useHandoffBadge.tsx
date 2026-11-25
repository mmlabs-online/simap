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
import type { HandoffCountDto } from "@/lib/devices/types";
import { useApiFetch } from "../auth/api-fetch-context";
import { useSession } from "../session";
import { createDevicesApi } from "./devices-api";

type Badge = {
  count: HandoffCountDto;
  set: (c: HandoffCountDto) => void;
  seq: { current: number };
};

const ZERO: HandoffCountDto = { incoming: 0, returns: 0, extensions: 0, overdue: 0 };

const BadgeContext = createContext<Badge | null>(null);

/**
 * Holds the incoming transfers and pending returns counts. `set` bumps a sequence number first, so a fetch that started
 * earlier can never overwrite a newer value.
 */
export function HandoffBadgeProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState<HandoffCountDto>(ZERO);
  const seq = useRef(0);
  const set = useCallback((c: HandoffCountDto) => {
    seq.current += 1;
    setCount(c);
  }, []);
  const value = useMemo(() => ({ count, set, seq }), [count, set]);
  return <BadgeContext.Provider value={value}>{children}</BadgeContext.Provider>;
}

const noop = () => {};

/** The page's way to update the badge at once (a no-op outside the provider). */
export function useSetHandoffBadge(): (c: HandoffCountDto) => void {
  return useContext(BadgeContext)?.set ?? noop;
}

/**
 * The badge count for the shell. Refreshes on mount, on a route change, on window focus and when the tab
 * becomes visible. No polling (D24). A failed refresh keeps the last count.
 */
export function useHandoffBadge(pathname: string): HandoffCountDto {
  const ctx = useContext(BadgeContext);
  const apiFetch = useApiFetch();
  const api = useMemo(() => createDevicesApi(apiFetch), [apiFetch]);
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
    const r = await api.handoffCount();
    if (!mounted.current || !r.ok || seq.current !== mine) return;
    set(r.value);
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

  return ctx?.count ?? ZERO;
}
