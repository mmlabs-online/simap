import type { WhosHereRow } from "@/lib/presence/whos-here";
import type { Atlas } from "../roomlayout/loadAtlas";
import { Button } from "../Button";
import { presenceCopy } from "../copy/presence";
import { PixelHead } from "./PixelHead";

/** The "Who's here" list of one room. Pure: rows, state and handlers come from props. */
export function WhosHere({
  status,
  rows,
  stale,
  atlas,
  onFocus,
  onRetry,
}: {
  status: "loading" | "ready" | "error";
  rows: readonly WhosHereRow[];
  stale: boolean;
  atlas: Atlas | null;
  onFocus: (seatCode: string) => void;
  onRetry: () => void;
}) {
  if (status === "loading") {
    return (
      <p aria-busy="true" role="status" className="mt-2 text-sm text-on-surface-variant">
        {presenceCopy.loading}
      </p>
    );
  }
  if (status === "error") {
    return (
      <div className="mt-2 flex flex-col items-start gap-3">
        <p role="alert" className="text-sm font-semibold text-error">
          {presenceCopy.error}
        </p>
        <Button variant="tonal" size="sm" onClick={onRetry}>
          {presenceCopy.retry}
        </Button>
      </div>
    );
  }
  return (
    <div className="mt-2 flex flex-col gap-2">
      {stale && (
        <p role="status" className="text-sm font-semibold text-on-surface-variant">
          {presenceCopy.stale}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-on-surface-variant">{presenceCopy.empty}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((row) => {
            const name = row.unnamed ? presenceCopy.unnamed : row.name;
            return (
              <li key={`${row.memberId}:${row.seatCode}`}>
                <button
                  type="button"
                  disabled={!row.focusable}
                  aria-label={presenceCopy.focusLabel(name, row.seatCode)}
                  onClick={() => onFocus(row.seatCode)}
                  className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left enabled:cursor-pointer enabled:hover:bg-surface-container-high focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-70"
                >
                  <PixelHead atlas={atlas} look={row.look} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-bold text-on-surface">{name}</span>
                    <span className="text-xs text-on-surface-variant">
                      {row.seatCode} · <time dateTime={row.checkedInAt}>{row.time}</time> ·{" "}
                      {presenceCopy.source[row.source]}
                      {row.focusable ? null : ` · ${presenceCopy.notOnMap}`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
