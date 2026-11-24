"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { RequestListItemDto, RequestStatus } from "@/lib/requests/types";
import { useApiFetch } from "../auth/api-fetch-context";
import { Card } from "../Card";
import { useSession } from "../session";
import { ApprovalsView } from "./ApprovalsView";
import { DecisionDialog, type DecisionTarget } from "./DecisionDialog";
import { RequestRowActions } from "./RequestRowActions";
import { createRequestsApi } from "./requests-api";
import {
  rivalNames,
  settleDecision,
  type DecisionAction,
  type DecisionOutcome,
} from "./requests-flow";
import { canViewApprovals, parseStatusParam, statusHref } from "./requests-state";
import { useRequests } from "./useRequests";

const noop = () => {};

function ApprovalsLoaded({ status }: { status: RequestStatus }) {
  const router = useRouter();
  const pathname = usePathname();
  const apiFetch = useApiFetch();
  const api = useMemo(() => createRequestsApi(apiFetch), [apiFetch]);
  const requests = useRequests(api, status);
  const mounted = useRef(true);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [target, setTarget] = useState<DecisionTarget | null>(null);
  const [busy, setBusy] = useState<{ id: string; action: DecisionAction } | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [notice, setNotice] = useState<DecisionOutcome["notice"]>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const open = (item: RequestListItemDto, action: DecisionAction) => {
    if (busy !== null) return;
    setNotice(null);
    setDialogError(null);
    setTarget({
      item,
      action,
      rivals: rivalNames(requests.items, item),
      partial: requests.hasMore,
    });
  };

  const onClose = () => {
    if (busy !== null) return;
    setTarget(null);
    setDialogError(null);
  };

  const onConfirm = async () => {
    if (busy !== null || target === null) return;
    const { item, action } = target;
    setBusy({ id: item.id, action });
    setDialogError(null);
    const outcome = settleDecision(action, await api[action](item.id));
    if (!mounted.current) return;
    setNotice(outcome.notice);
    setDialogError(outcome.dialogError);
    if (outcome.close) {
      setTarget(null);
      void requests.reload().then(() => {
        if (mounted.current) headingRef.current?.focus();
      });
    } else if (outcome.reload) {
      void requests.reload();
    }
    setBusy(null);
  };

  return (
    <>
      <ApprovalsView
        state={requests.status}
        filter={status}
        items={requests.items}
        hasMore={requests.hasMore}
        loadingMore={requests.loadingMore}
        errorCode={requests.errorCode}
        notice={notice}
        headingRef={headingRef}
        onFilter={(next) => {
          setNotice(null);
          router.replace(statusHref(pathname, next), { scroll: false });
        }}
        onRetry={() => void requests.reload()}
        onLoadMore={() => void requests.loadMore()}
        actions={(it) => (
          <RequestRowActions
            item={it}
            busy={busy}
            onApprove={(i) => open(i, "approve")}
            onReject={(i) => open(i, "reject")}
          />
        )}
      />
      <DecisionDialog
        target={target}
        submitting={busy !== null}
        error={dialogError}
        onClose={onClose}
        onConfirm={() => void onConfirm()}
      />
    </>
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
