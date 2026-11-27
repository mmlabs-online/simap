import type { ReactNode } from "react";
import { apiErrorMessage } from "../copy/api";
import { groupsCopy } from "../copy/groups";
import { Button } from "../Button";
import { Card } from "../Card";

export type ListState<T> = {
  status: "loading" | "error" | "ready";
  items: readonly T[];
  errorCode: string | null;
};

/** One titled list (groups or projects): New button, loading skeleton, error with retry, empty text, rows. Pure. */
export function ListSection<T>({
  title,
  newLabel,
  emptyText,
  list,
  rowKey,
  renderRow,
  onNew,
  onRetry,
}: {
  title: string;
  newLabel: string;
  emptyText: string;
  list: ListState<T>;
  rowKey: (item: T) => string;
  renderRow: (item: T) => ReactNode;
  onNew: () => void;
  onRetry: () => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-subtitle text-text-primary">{title}</h2>
        <Button icon="add" size="sm" onClick={onNew}>
          {newLabel}
        </Button>
      </div>

      {list.status === "loading" && (
        <div aria-busy="true" className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <Card key={i} className="h-14 animate-pulse">
              {null}
            </Card>
          ))}
        </div>
      )}

      {list.status === "error" && (
        <Card className="flex flex-col items-start gap-3 p-4">
          <p role="alert" className="text-label font-semibold text-danger">
            {apiErrorMessage(list.errorCode ?? "internal")}
          </p>
          <Button variant="tonal" size="sm" onClick={onRetry}>
            {groupsCopy.retry}
          </Button>
        </Card>
      )}

      {list.status === "ready" && list.items.length === 0 && (
        <Card className="px-6 py-8 text-center">
          <p className="text-label text-text-secondary">{emptyText}</p>
        </Card>
      )}

      {list.status === "ready" && list.items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {list.items.map((item) => (
            <li key={rowKey(item)}>
              <Card className="flex items-center justify-between gap-3 px-4 py-3">
                {renderRow(item)}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
