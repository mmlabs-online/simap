"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApiFetch } from "../auth/api-fetch-context";
import { useAtlas } from "../roomlayout/useAtlas";
import { createPixelLookApi } from "./pixel-look-api";
import {
  afterReset,
  afterSave,
  canReset,
  canSave,
  choose,
  initialPicker,
  isDerived,
  loaded,
  startBusy,
} from "./pixel-look-state";
import { PixelLookPicker } from "./PixelLookPicker";

/** Connects the pixel character picker to `/api/me/pixel-look`. `memberId` seeds the derived look. */
export function PixelLookSection({ memberId }: { memberId: string }) {
  const apiFetch = useApiFetch();
  const api = useMemo(() => createPixelLookApi(apiFetch), [apiFetch]);
  const atlas = useAtlas();
  const [state, setState] = useState(() => initialPicker(memberId));
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    void api.get().then((r) => {
      if (mounted.current) setState((s) => loaded(s, r));
    });
  }, [api]);

  const save = async () => {
    if (!canSave(state)) return;
    setState(startBusy(state, "save"));
    const r = await api.save(state.draft);
    if (mounted.current) setState((s) => afterSave(s, r));
  };

  const reset = async () => {
    if (!canReset(state)) return;
    setState(startBusy(state, "reset"));
    const r = await api.reset();
    if (mounted.current) setState((s) => afterReset(s, r));
  };

  return (
    <PixelLookPicker
      draft={state.draft}
      isDerived={isDerived(state)}
      status={state.status}
      busy={state.busy}
      canSave={canSave(state)}
      canReset={canReset(state)}
      notice={state.notice}
      atlas={atlas.atlas}
      atlasFailed={atlas.failed}
      onChoose={(key, value) => setState((s) => choose(s, key, value))}
      onSave={() => void save()}
      onReset={() => void reset()}
    />
  );
}
