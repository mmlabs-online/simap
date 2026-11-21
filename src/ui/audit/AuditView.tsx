import type { AuditEntryDto, AuditFacets } from "@/lib/audit/types";
import { DialogField, DialogSelect } from "../EntityFormDialog";
import { apiErrorMessage } from "../copy/api";
import { actionLabel, auditCopy } from "../copy/audit";
import { shellCopy } from "../copy/shell";
import { Button } from "../Button";
import { Card } from "../Card";
import { actorLabel, formatAuditTime, metaEntries, type AuditFilterState } from "./audit-state";

export type AuditViewProps = {
  status: "loading" | "error" | "ready" | "forbidden";
  items: AuditEntryDto[];
  facets: AuditFacets;
  filters: AuditFilterState;
  rangeInvalid: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  errorCode: string | null;
  onFilters: (next: AuditFilterState) => void;
  onReset: () => void;
  onRetry: () => void;
  onLoadMore: () => void;
};

const CELL = "px-3 py-2 align-top text-sm text-on-surface";
const HEAD = "px-3 py-2 text-left text-[11px] font-extrabold uppercase text-on-surface-variant";

/** The Audit page body (D52: clean kit, no pixel font). Pure: data and handlers come from props. */
export function AuditView({
  status,
  items,
  facets,
  filters,
  rangeInvalid,
  hasMore,
  loadingMore,
  errorCode,
  onFilters,
  onReset,
  onRetry,
  onLoadMore,
}: AuditViewProps) {
  const title = (
    <h1 className="text-h2 font-extrabold text-on-surface">{shellCopy.pages.audit.title}</h1>
  );
  if (status === "forbidden") {
    return (
      <div className="p-4 lg:p-6 flex flex-col gap-4">
        {title}
        <Card className="px-6 py-12 text-center">
          <p role="alert" className="text-sm font-medium text-on-surface-variant">
            {auditCopy.noAccess}
          </p>
        </Card>
      </div>
    );
  }

  const filtered = Object.values(filters).some((v) => v !== "");
  const set = (patch: Partial<AuditFilterState>) => onFilters({ ...filters, ...patch });

  return (
    <div className="p-4 lg:p-6 flex flex-col gap-4">
      {title}

      <Card className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5 items-end">
        <DialogSelect
          label={auditCopy.filters.actor}
          icon="person"
          value={filters.actor}
          onChange={(e) => set({ actor: e.target.value })}
        >
          <option value="">{auditCopy.filters.all}</option>
          {facets.actors.map((a) => (
            <option key={a.sub} value={a.sub}>
              {actorLabel(a)}
            </option>
          ))}
        </DialogSelect>
        <DialogSelect
          label={auditCopy.filters.entity}
          icon="grid_view"
          value={filters.entity}
          onChange={(e) => set({ entity: e.target.value })}
        >
          <option value="">{auditCopy.filters.all}</option>
          {facets.entities.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </DialogSelect>
        <DialogField
          label={auditCopy.filters.from}
          icon="history"
          type="date"
          value={filters.fromDay}
          onChange={(e) => set({ fromDay: e.target.value })}
        />
        <DialogField
          label={auditCopy.filters.to}
          icon="history"
          type="date"
          value={filters.toDay}
          onChange={(e) => set({ toDay: e.target.value })}
        />
        <div>
          <Button variant="tonal" size="sm" icon="close" disabled={!filtered} onClick={onReset}>
            {auditCopy.reset}
          </Button>
        </div>
      </Card>

      {rangeInvalid && (
        <p role="alert" className="text-sm font-semibold text-error">
          {auditCopy.rangeInvalid}
        </p>
      )}

      {status === "loading" && (
        <Card className="h-40 animate-pulse">
          <div aria-busy="true" className="h-full" />
        </Card>
      )}

      {status === "error" && (
        <Card className="flex flex-col items-start gap-3 p-4">
          <p role="alert" className="text-sm font-semibold text-error">
            {apiErrorMessage(errorCode ?? "internal")}
          </p>
          <Button variant="tonal" size="sm" onClick={onRetry}>
            {auditCopy.retry}
          </Button>
        </Card>
      )}

      {status === "ready" && items.length === 0 && !rangeInvalid && (
        <Card className="px-6 py-12 text-center">
          <p className="text-sm font-medium text-on-surface-variant">
            {filtered ? auditCopy.emptyFiltered : shellCopy.pages.audit.empty}
          </p>
        </Card>
      )}

      {status === "ready" && items.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse">
            <thead>
              <tr className="border-b border-outline-variant">
                <th className={HEAD}>{auditCopy.columns.when}</th>
                <th className={HEAD}>{auditCopy.columns.who}</th>
                <th className={HEAD}>{auditCopy.columns.action}</th>
                <th className={HEAD}>{auditCopy.columns.entity}</th>
                <th className={HEAD}>{auditCopy.columns.details}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const meta = metaEntries(it.meta);
                return (
                  <tr key={it.id} className="border-b border-outline-variant last:border-b-0">
                    <td className={`${CELL} whitespace-nowrap`}>{formatAuditTime(it.at)}</td>
                    <td className={CELL}>{actorLabel(it.actor)}</td>
                    <td className={CELL}>{actionLabel(it.action)}</td>
                    <td className={CELL}>
                      {it.entity}
                      {it.entityId !== null && (
                        <span className="block break-all text-xs text-on-surface-variant">
                          {it.entityId}
                        </span>
                      )}
                    </td>
                    <td className={`${CELL} break-words`}>
                      {meta.map(([k, v]) => (
                        <span key={k} className="block text-xs">
                          {k}: {v}
                        </span>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {status === "ready" && hasMore && (
        <div>
          <Button variant="tonal" disabled={loadingMore} onClick={onLoadMore}>
            {loadingMore ? auditCopy.loadingMore : auditCopy.loadMore}
          </Button>
        </div>
      )}
    </div>
  );
}
