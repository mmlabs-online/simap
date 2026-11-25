"use client";

import { useEffect, useState } from "react";
import { useApiFetch } from "../auth/api-fetch-context";
import { createDeviceTypesApi } from "./device-types-api";
import { typeSuggestions, type SuggestionState } from "./device-types-state";

/** Catalog names for the device Type field. Loads once on mount; the seed list shows until then and on error. */
export function useTypeSuggestions(): readonly string[] {
  const apiFetch = useApiFetch();
  const [state, setState] = useState<SuggestionState>({ status: "loading" });

  useEffect(() => {
    let live = true;
    void createDeviceTypesApi(apiFetch)
      .list()
      .then((r) => {
        if (!live) return;
        setState(
          r.ok ? { status: "ready", names: r.value.map((t) => t.name) } : { status: "error" },
        );
      });
    return () => {
      live = false;
    };
  }, [apiFetch]);

  return typeSuggestions(state);
}
