"use client";

import { Suspense, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApiFetch } from "../auth/api-fetch-context";
import { Card } from "../Card";
import { createSearchApi } from "./search-api";
import { parseSearchParam, searchHref } from "./search-state";
import { SearchView } from "./SearchView";
import { useSearch } from "./useSearch";

function SearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const apiFetch = useApiFetch();
  const api = useMemo(() => createSearchApi(apiFetch), [apiFetch]);
  const urlQ = parseSearchParam(searchParams.getAll("q"));
  const onCommit = useCallback(
    (q: string) => router.replace(searchHref(q), { scroll: false }),
    [router],
  );
  const search = useSearch(api, urlQ, onCommit);
  return (
    <SearchView
      query={search.query}
      onQueryChange={search.setQuery}
      state={search.state}
      onRetry={search.retry}
      onLoadMore={(group) => void search.loadMore(group)}
    />
  );
}

/** Search page. `useSearchParams` sits inside `<Suspense>`. */
export function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="page-content">
          <Card className="h-48 animate-pulse">
            <div aria-busy="true" />
          </Card>
        </div>
      }
    >
      <SearchPageInner />
    </Suspense>
  );
}
