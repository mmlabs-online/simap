"use client";

import { Suspense, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { RequestStatus } from "@/lib/requests/types";
import { useApiFetch } from "../auth/api-fetch-context";
import { Card } from "../Card";
import { useSession } from "../session";
import { ApprovalsView } from "./ApprovalsView";
import { createRequestsApi } from "./requests-api";
import { canViewApprovals, parseStatusParam, statusHref } from "./requests-state";
import { useRequests } from "./useRequests";

const noop = () => {};

function ApprovalsLoaded({ status }: { status: RequestStatus }) {
  const router = useRouter();
  const pathname = usePathname();
  const apiFetch = useApiFetch();
  const api = useMemo(() => createRequestsApi(apiFetch), [apiFetch]);
  const requests = useRequests(api, status);

  return (
    <ApprovalsView
      state={requests.status}
      filter={status}
      items={requests.items}
      hasMore={requests.hasMore}
      loadingMore={requests.loadingMore}
      errorCode={requests.errorCode}
      onFilter={(next) => router.replace(statusHref(pathname, next), { scroll: false })}
      onRetry={() => void requests.reload()}
      onLoadMore={() => void requests.loadMore()}
    />
  );
}

function ApprovalsPageInner() {
  const session = useSession();
  const searchParams = useSearchParams();
  if (!canViewApprovals(session?.tier)) {
    return (
      <ApprovalsView
        state="forbidden"
        filter="pending"
        items={[]}
        hasMore={false}
        loadingMore={false}
        errorCode={null}
        onFilter={noop}
        onRetry={noop}
        onLoadMore={noop}
      />
    );
  }
  return <ApprovalsLoaded status={parseStatusParam(searchParams.getAll("status"))} />;
}

/** Approvals page. `useSearchParams` sits inside `<Suspense>`. Non-managers never trigger a request. */
export function ApprovalsPage() {
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
      <ApprovalsPageInner />
    </Suspense>
  );
}
