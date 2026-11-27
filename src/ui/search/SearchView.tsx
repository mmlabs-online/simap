import Link from "next/link";
import { deviceDetailHref } from "@/lib/nav";
import type { DeviceHit, MemberHit, SeatHit } from "@/lib/search/types";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import { searchCopy as copy } from "../copy/search";
import { Button } from "../Button";
import { Card } from "../Card";
import { Pill } from "../Chip";
import { FilledInput } from "../FilledInput";
import {
  GROUP_ORDER,
  MEMBERS_HREF,
  seatResultHref,
  type GroupKey,
  type SearchState,
} from "./search-state";

export type SearchViewProps = {
  query: string;
  onQueryChange: (q: string) => void;
  state: SearchState;
  onRetry: () => void;
  onLoadMore: (group: GroupKey) => void;
};

const LINK = "font-semibold text-text-primary hover:underline";
const META = "text-label text-text-secondary";

function SeatRow({ hit }: { hit: SeatHit }) {
  const href = seatResultHref(hit);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label font-normal">
      {href ? (
        <Link href={href} className={LINK}>
          {hit.code}
        </Link>
      ) : (
        <span className="font-semibold text-text-primary">{hit.code}</span>
      )}
      <span className={META}>{hit.roomCode}</span>
      <span className="text-text-primary">{hit.occupant?.displayName ?? copy.emptySeat}</span>
    </li>
  );
}

function DeviceRow({ hit }: { hit: DeviceHit }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label font-normal">
      <Link href={deviceDetailHref(hit.id)} className={LINK}>
        {hit.name}
      </Link>
      <span className={META}>{hit.inventoryNumber}</span>
      {hit.mac !== null && <span className={META}>{copy.mac(hit.mac)}</span>}
      <span className="text-text-primary">
        {hit.owner?.displayName ?? devicesCopy.orgInventory}
      </span>
      <span className={META}>
        {hit.placement
          ? copy.placement(hit.placement.roomCode, hit.placement.seatCode)
          : copy.inInventory}
      </span>
    </li>
  );
}

function MemberRow({ hit }: { hit: MemberHit }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label font-normal">
      <Link href={MEMBERS_HREF} className={LINK}>
        {hit.displayName}
      </Link>
      {hit.employeeCode !== null && <span className={META}>{hit.employeeCode}</span>}
      {hit.status === "deactivated" && <Pill dot tone="neutral" label={copy.deactivated} />}
    </li>
  );
}

function Group({
  group,
  state,
  onLoadMore,
}: {
  group: GroupKey;
  state: SearchState;
  onLoadMore: (group: GroupKey) => void;
}) {
  const g = state[group];
  const text = copy.groups[group];
  const headingId = `search-${group}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="flex items-baseline gap-2 text-subtitle text-text-primary">
        {text.title}
        <span className={META}>{copy.count(g.items.length, g.nextCursor !== null)}</span>
      </h2>
      <Card className="flex flex-col gap-3 p-4">
        {g.items.length === 0 ? (
          <p className="text-label text-text-secondary">{text.empty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {group === "seats" &&
              state.seats.items.map((hit) => <SeatRow key={hit.id} hit={hit} />)}
            {group === "devices" &&
              state.devices.items.map((hit) => <DeviceRow key={hit.id} hit={hit} />)}
            {group === "members" &&
              state.members.items.map((hit) => <MemberRow key={hit.id} hit={hit} />)}
          </ul>
        )}
        {g.moreError !== null && (
          <div className="flex flex-wrap items-center gap-3">
            <p role="alert" className="text-label font-semibold text-danger">
              {apiErrorMessage(g.moreError)}
            </p>
            <Button variant="tonal" size="sm" onClick={() => onLoadMore(group)}>
              {copy.retry}
            </Button>
          </div>
        )}
        {g.nextCursor !== null && (
          <div>
            <Button
              variant="tonal"
              size="sm"
              disabled={g.moreId !== null}
              onClick={() => onLoadMore(group)}
            >
              {g.moreId !== null ? copy.loadingMore : copy.loadMore}
            </Button>
          </div>
        )}
      </Card>
    </section>
  );
}

/** The Search page body. Pure: state and handlers come from props. Names render as stored (D36). */
export function SearchView({ query, onQueryChange, state, onRetry, onLoadMore }: SearchViewProps) {
  return (
    <div className="page-content flex flex-col gap-4">
      <h1 className="text-display text-text-primary">{copy.title}</h1>
      <FilledInput
        type="search"
        aria-label={copy.inputLabel}
        placeholder={copy.placeholder}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
      />

      {state.status === "idle" && <p className="text-label text-text-secondary">{copy.prompt}</p>}

      {state.status === "loading" && (
        <Card className="h-48 animate-pulse">
          <div aria-busy="true" />
        </Card>
      )}

      {state.status === "error" && (
        <Card className="flex flex-col items-start gap-3 p-4">
          <p role="alert" className="text-label font-semibold text-danger">
            {apiErrorMessage(state.errorCode ?? "internal")}
          </p>
          <Button variant="tonal" size="sm" onClick={onRetry}>
            {copy.retry}
          </Button>
        </Card>
      )}

      {state.status === "ready" &&
        GROUP_ORDER.map((group) => (
          <Group key={group} group={group} state={state} onLoadMore={onLoadMore} />
        ))}
    </div>
  );
}
