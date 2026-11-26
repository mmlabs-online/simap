"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { requestsPageRedirect } from "../portal/portal-state";

/** `/requests` is gone (D74): send old bookmarks to My Portal → My seat. Renders only below `AuthGate`. */
export function RequestsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(requestsPageRedirect);
  }, [router]);
  return null;
}
