"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppShellView } from "./AppShellView";
import { RequestBadgeProvider, useRequestBadge } from "./requests/useRequestBadge";
import { RoomSwitcher } from "./RoomSwitcher";
import { useSession, useShellActions } from "./session";

function ShellWithBadge({ children }: { children: ReactNode }) {
  const session = useSession();
  const actions = useShellActions();
  const pathname = usePathname() ?? "/";
  const count = useRequestBadge(pathname);
  return (
    <AppShellView
      session={session}
      pathname={pathname}
      actions={actions}
      badges={{ myRequests: count }}
      roomSwitcher={session ? <RoomSwitcher pathname={pathname} /> : undefined}
    >
      {children}
    </AppShellView>
  );
}

/** Connects the presentational shell to the session context, the router and the request badge. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <RequestBadgeProvider>
      <ShellWithBadge>{children}</ShellWithBadge>
    </RequestBadgeProvider>
  );
}
