"use client";

import { useMemo, useState } from "react";
import { useApiFetch } from "../auth/api-fetch-context";
import { useSession } from "../session";
import { AuditView } from "./AuditView";
import { createAuditApi } from "./audit-api";
import { canViewAudit, EMPTY_FILTERS, toApiFilter, type AuditFilterState } from "./audit-state";
import { useAudit } from "./useAudit";

const NO_ITEMS: never[] = [];
const NO_FACETS = { actors: [], entities: [] };
const noop = () => {};

/** Audit page. Non-admins get the no-access message and the data hook is never mounted (no request). */
export function AuditPage() {
  const session = useSession();
  if (!canViewAudit(session?.tier)) {
    return (
      <AuditView
        status="forbidden"
        items={NO_ITEMS}
        facets={NO_FACETS}
        filters={EMPTY_FILTERS}
        rangeInvalid={false}
        hasMore={false}
        loadingMore={false}
        errorCode={null}
        onFilters={noop}
        onReset={noop}
        onRetry={noop}
        onLoadMore={noop}
      />
    );
  }
  return <AuditLoaded />;
}

function AuditLoaded() {
  const apiFetch = useApiFetch();
  const api = useMemo(() => createAuditApi(apiFetch), [apiFetch]);
  const [filters, setFilters] = useState<AuditFilterState>(EMPTY_FILTERS);
  const query = useMemo(() => toApiFilter(filters), [filters]);
  const audit = useAudit(api, query);

  return (
    <AuditView
      status={audit.status}
      items={audit.items}
      facets={audit.facets}
      filters={filters}
      rangeInvalid={query === null}
      hasMore={audit.hasMore}
      loadingMore={audit.loadingMore}
      errorCode={audit.errorCode}
      onFilters={setFilters}
      onReset={() => setFilters(EMPTY_FILTERS)}
      onRetry={() => void audit.reload()}
      onLoadMore={() => void audit.loadMore()}
    />
  );
}
