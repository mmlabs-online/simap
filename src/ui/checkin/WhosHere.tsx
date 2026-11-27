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
      <p aria-busy="true" role="status" className="mt-2 text-label font-normal text-text-secondary">
        {presenceCopy.loading}
      </p>
    );
  }
  if (status === "error") {
    return (
      <div className="mt-2 flex flex-col items-start gap-3">
        <p role="alert" className="text-label font-semibold text-danger">
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
        <p role="status" className="text-label font-semibold text-text-secondary">
          {presenceCopy.stale}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="text-label font-normal text-text-secondary">{presenceCopy.empty}</p>
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
                  className="flex min-h-control w-full items-center gap-3 rounded-lg px-2 text-left enabled:cursor-pointer enabled:hover:bg-canvas disabled:cursor-not-allowed transition-[color,background-color,border-color,box-shadow,transform] duration-(--duration-ui) ease-out"
                >
                  <PixelHead atlas={atlas} look={row.look} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-label font-semibold text-text-primary">
                      {name}
                    </span>
                    <span className="text-caption text-text-secondary">
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
