"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppShellView } from "./AppShellView";
import { RoomSwitcher } from "./RoomSwitcher";
import { useSession, useShellActions } from "./session";

/** Connects the presentational shell to the session context and the router. */
export function AppShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const actions = useShellActions();
  const pathname = usePathname() ?? "/";
  return (
    <AppShellView
      session={session}
      pathname={pathname}
      actions={actions}
      roomSwitcher={session ? <RoomSwitcher pathname={pathname} /> : undefined}
    >
      {children}
    </AppShellView>
  );
}
