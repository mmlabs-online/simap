"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApiFetch } from "../auth/api-fetch-context";
import { useAtlas } from "../roomlayout/useAtlas";
import { createPixelLookApi } from "./pixel-look-api";
import {
  afterReset,
  afterSave,
  choose,
  discard,
  initialPicker,
  loaded,
  lookSaveAction,
  resetDraft,
  startBusy,
  type PickerState,
  type PixelLookKey,
} from "./pixel-look-state";

/** The pixel character draft and its `/api/me/pixel-look` calls. Inert while `memberId` is null. */
export function usePixelLook(memberId: string | null) {
  const apiFetch = useApiFetch();
  const api = useMemo(() => createPixelLookApi(apiFetch), [apiFetch]);
  const atlas = useAtlas();
  const [state, setState] = useState<PickerState>(() => initialPicker(memberId ?? ""));
  const stateRef = useRef(state);
  stateRef.current = state;
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (memberId === null) return;
    void api.get().then((r) => {
      if (mounted.current) setState((s) => loaded(s, r));
    });
  }, [api, memberId]);

  /** Sends the pending change; resolves to the error text, or null on success or when nothing is pending. */
  const persist = async (): Promise<string | null> => {
    const current = stateRef.current;
    const action = memberId === null ? null : lookSaveAction(current);
    if (action === null) return null;
    const busy = action === "save" ? "save" : "reset";
    setState(startBusy(current, busy));
    if (action === "save") {
      const r = await api.save(current.draft);
      const next = afterSave(startBusy(current, busy), r);
      if (mounted.current) setState((s) => afterSave(s, r));
      return r.ok ? null : (next.notice?.text ?? null);
    }
    const r = await api.reset();
    const next = afterReset(startBusy(current, busy), r);
    if (mounted.current) setState((s) => afterReset(s, r));
    return r.ok ? null : (next.notice?.text ?? null);
  };

  return {
    state,
    atlas: atlas.atlas,
    atlasFailed: atlas.failed,
    choose: (key: PixelLookKey, value: number) => setState((s) => choose(s, key, value)),
    resetDraft: () => setState((s) => resetDraft(s)),
    discard: () => setState((s) => discard(s)),
    persist,
  };
}
