"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiFetch } from "@/lib/api/fetch";
import type { SeatDto } from "@/lib/seats/types";
import type { createSeatsApi } from "../seats/seats-api";
import { loadMySeats } from "./my-seats";

type State = { status: "loading" | "ready" | "error"; seats: SeatDto[]; errorCode: string | null };
const INITIAL: State = { status: "loading", seats: [], errorCode: null };

/** Loads the caller's seats. Stale answers are dropped by a counter. */
export function useMySeats(apiFetch: ApiFetch, seatsApi: ReturnType<typeof createSeatsApi>) {
  const [state, setState] = useState<State>(INITIAL);
  const counter = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    const id = ++counter.current;
    setState(INITIAL);
    const r = await loadMySeats(apiFetch, seatsApi);
    if (!mounted.current || id !== counter.current) return;
    setState(
      r.ok
        ? { status: "ready", seats: r.seats, errorCode: null }
        : { status: "error", seats: [], errorCode: r.code },
    );
  }, [apiFetch, seatsApi]);

  /** Refetches without a skeleton; a failed refresh keeps the rows. */
  const refresh = useCallback(async () => {
    const id = ++counter.current;
    const r = await loadMySeats(apiFetch, seatsApi);
    if (!mounted.current || id !== counter.current) return;
    if (r.ok) setState({ status: "ready", seats: r.seats, errorCode: null });
  }, [apiFetch, seatsApi]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload, refresh };
}
