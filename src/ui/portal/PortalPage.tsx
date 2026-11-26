"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card } from "../Card";
import { shellCopy } from "../copy/shell";
import { MyDevicesTab } from "./MyDevicesTab";
import { MySeatTab } from "./MySeatTab";
import { PortalTabs } from "./PortalTabs";
import { ProfileTab } from "./ProfileTab";
import { PORTAL_TABS, panelId, parsePortalTab, portalTabHref, tabId } from "./portal-state";

function PortalLoaded() {
  const router = useRouter();
  const pathname = usePathname() ?? "/portal";
  const searchParams = useSearchParams();
  const tab = parsePortalTab(searchParams.getAll("tab"));
  return (
    <div className="p-4 lg:p-6 flex flex-col gap-4">
      <h1 className="text-h2 font-extrabold text-on-surface">{shellCopy.pages.portal.title}</h1>
      <PortalTabs
        tabs={PORTAL_TABS}
        active={tab}
        onSelect={(next) => router.replace(portalTabHref(pathname, next), { scroll: false })}
      />
      <div role="tabpanel" id={panelId(tab)} aria-labelledby={tabId(tab)} tabIndex={0}>
        {tab === "seat" && <MySeatTab />}
        {tab === "devices" && <MyDevicesTab />}
        {tab === "profile" && <ProfileTab />}
      </div>
    </div>
  );
}

/** My Portal. `useSearchParams` sits inside `<Suspense>`. Renders only below `AuthGate`. */
export function PortalPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 lg:p-6">
          <Card className="h-48 animate-pulse">
            <div aria-busy="true" />
          </Card>
        </div>
      }
    >
      <PortalLoaded />
    </Suspense>
  );
}
