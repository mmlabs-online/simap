"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { shellCopy } from "./copy/shell";
import { AppShellView } from "./AppShellView";
import { badgeTotal } from "./devices/incoming-transfer";
import { portalBadgeTotal } from "./portal/portal-state";
import { HandoffBadgeProvider, useHandoffBadge } from "./devices/useHandoffBadge";
import { RequestBadgeProvider, useRequestBadge } from "./requests/useRequestBadge";
import { RoomSwitcher } from "./RoomSwitcher";
import { useSession, useShellActions } from "./session";

function ShellWithBadge({ children }: { children: ReactNode }) {
  const session = useSession();
  const actions = useShellActions();
  const pathname = usePathname() ?? "/";
  const count = useRequestBadge(pathname);
  const handoffs = useHandoffBadge(pathname);
  return (
    <AppShellView
      session={session}
      pathname={pathname}
      actions={actions}
      badges={{
        devices: badgeTotal(handoffs),
        portal: portalBadgeTotal(handoffs, count),
      }}
      badgeLabels={{
        devices: shellCopy.badge.devicesBreakdown(handoffs),
        portal: shellCopy.badge.portalBreakdown(handoffs, count),
      }}
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
      <HandoffBadgeProvider>
        <ShellWithBadge>{children}</ShellWithBadge>
      </HandoffBadgeProvider>
    </RequestBadgeProvider>
  );
}
