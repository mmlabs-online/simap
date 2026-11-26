"use client";

import type { ReactNode } from "react";
import { homeFor } from "@/lib/nav";
import { DashboardPage } from "../dashboard/DashboardPage";
import { useSession } from "../session";
import { CheckinPage } from "./CheckinPage";

/** Picks the page at "/" by the session's tier (PRE-01, D76). Renders nothing without a session. */
export function HomeSwitch({ checkin, dashboard }: { checkin: ReactNode; dashboard: ReactNode }) {
  const session = useSession();
  if (!session) return null;
  return homeFor(session.tier) === "checkin" ? checkin : dashboard;
}

export function HomePage() {
  return <HomeSwitch checkin={<CheckinPage />} dashboard={<DashboardPage />} />;
}
