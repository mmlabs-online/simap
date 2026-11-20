"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ApiFetch } from "@/lib/api/fetch";

const ApiFetchContext = createContext<ApiFetch | null>(null);

/** Provides the one bearer-attaching `apiFetch` to everything under the signed-in gate. */
export function ApiFetchProvider({ value, children }: { value: ApiFetch; children: ReactNode }) {
  return <ApiFetchContext.Provider value={value}>{children}</ApiFetchContext.Provider>;
}

/** The `apiFetch` for UI data calls to `/api/*`. Only valid below `AuthGate`. */
export function useApiFetch(): ApiFetch {
  const fn = useContext(ApiFetchContext);
  if (!fn) throw new Error("useApiFetch needs an ApiFetchProvider");
  return fn;
}
