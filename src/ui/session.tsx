"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Session } from "@/lib/session";

export type ShellActions = {
  switchOrg?: () => void;
  refreshPermissions?: () => void;
  signOut?: () => void;
};

const SessionContext = createContext<Session | null>(null);
const ActionsContext = createContext<ShellActions>({});

/** Provides the signed-in user (or `null`) and the shell actions. Wired by the auth tickets. */
export function SessionProvider({
  value,
  actions = {},
  children,
}: {
  value: Session | null;
  actions?: ShellActions;
  children: ReactNode;
}) {
  return (
    <SessionContext.Provider value={value}>
      <ActionsContext.Provider value={actions}>{children}</ActionsContext.Provider>
    </SessionContext.Provider>
  );
}

export function useSession(): Session | null {
  return useContext(SessionContext);
}

export function useShellActions(): ShellActions {
  return useContext(ActionsContext);
}
