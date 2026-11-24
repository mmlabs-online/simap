"use client";

import { useCallback, useEffect, useState } from "react";
import type { PendingInvitationDto } from "@/lib/members/types";
import type { MembersApi } from "./members-api";

export type InvitationsState = {
  status: "loading" | "error" | "ready";
  items: PendingInvitationDto[];
  errorCode: string | null;
  reload: () => void;
};

type Loaded = Omit<InvitationsState, "reload">;

const LOADING: Loaded = { status: "loading", items: [], errorCode: null };

/** Pending invitations, independent of the member list. `enabled` false (Users) -> null and no request. */
export function usePendingInvitations(api: MembersApi, enabled: boolean): InvitationsState | null {
  const [state, setState] = useState<Loaded>(LOADING);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void api.invitations().then((r) => {
      if (!live) return;
      setState(
        r.ok
          ? { status: "ready", items: r.value, errorCode: null }
          : { status: "error", items: [], errorCode: r.code },
      );
    });
    return () => {
      live = false;
    };
  }, [api, enabled, tick]);

  const reload = useCallback(() => {
    setState(LOADING);
    setTick((t) => t + 1);
  }, []);

  return enabled ? { ...state, reload } : null;
}
