import type { ReactNode } from "react";
import type { MemberDto, MemberStatusFilter } from "@/lib/members/types";
import { apiErrorMessage } from "../copy/api";
import { membersCopy } from "../copy/members";
import { shellCopy } from "../copy/shell";
import { Avatar } from "../Avatar";
import { Button } from "../Button";
import { Card } from "../Card";
import { FilterChips } from "../Chip";
import { FilledInput } from "../FilledInput";
import { moreCount, STATUS_FILTERS } from "./members-state";
import { PendingInvitations } from "./PendingInvitations";
import type { InvitationsState } from "./usePendingInvitations";

export type MembersViewProps = {
  status: "loading" | "error" | "ready";
  items: MemberDto[];
  errorCode: string | null;
  canManage: boolean;
  search: string;
  statusFilter: MemberStatusFilter;
  /** True when the committed search text is non-blank. */
  searching: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  invitations: InvitationsState | null;
  headerAction?: ReactNode;
  /** Blob URL of a member's loaded photo, or null (initials). */
  photoUrl?: (m: MemberDto) => string | null;
  onSearch: (value: string) => void;
  onSearchCommit: () => void;
  onStatusFilter: (value: MemberStatusFilter) => void;
  onRetry: () => void;
  onLoadMore: () => void;
  onEdit: (member: MemberDto) => void;
  onDeactivate: (member: MemberDto) => void;
  onReactivate: (member: MemberDto) => void;
};

const CELL = "px-3 py-2 align-top text-sm text-on-surface";
const HEAD = "px-3 py-2 text-left text-[11px] font-extrabold uppercase text-on-surface-variant";
const REFS = "mt-1 list-none p-0 text-xs text-on-surface-variant";

/** The Members page body. Pure: data and handlers come from props. */
export function MembersView(p: MembersViewProps) {
  const filtered = p.searching || p.statusFilter !== "active";

  return (
    <div className="page-content flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h2 font-extrabold text-on-surface">{shellCopy.pages.members.title}</h1>
        {p.headerAction}
      </div>
      <p className="text-sm font-medium text-on-surface-variant">{membersCopy.accountsNote}</p>

      <div className="flex flex-wrap items-center gap-3">
        <FilledInput
          className="flex-1 min-w-[14rem]"
          type="search"
          value={p.search}
          aria-label={membersCopy.search.label}
          placeholder={membersCopy.search.placeholder}
          onChange={(e) => p.onSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") p.onSearchCommit();
          }}
        />
        <FilterChips
          options={STATUS_FILTERS}
          value={p.statusFilter}
          onChange={p.onStatusFilter}
          ariaLabel={membersCopy.statusFilterLabel}
        />
      </div>

      {p.status === "loading" && (
        <Card className="h-40 animate-pulse">
          <div aria-busy="true" className="h-full" />
        </Card>
      )}

      {p.status === "error" && (
        <Card className="flex flex-col items-start gap-3 p-4">
          <p role="alert" className="text-sm font-semibold text-error">
            {apiErrorMessage(p.errorCode ?? "internal")}
          </p>
          <Button variant="tonal" size="sm" onClick={p.onRetry}>
            {membersCopy.retry}
          </Button>
        </Card>
      )}

      {p.status === "ready" && p.items.length === 0 && (
        <Card className="px-6 py-12 text-center">
          <p className="text-sm font-medium text-on-surface-variant">
            {filtered ? membersCopy.emptyFiltered : shellCopy.pages.members.empty}
          </p>
        </Card>
      )}

      {p.status === "ready" && p.items.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[56rem] border-collapse">
            <thead>
              <tr className="border-b border-outline-variant">
                <th className={HEAD}>{membersCopy.columns.name}</th>
                <th className={HEAD}>{membersCopy.columns.email}</th>
                <th className={HEAD}>{membersCopy.columns.code}</th>
                <th className={HEAD}>{membersCopy.columns.group}</th>
                <th className={HEAD}>{membersCopy.columns.status}</th>
                <th className={HEAD}>{membersCopy.columns.seats}</th>
                <th className={HEAD}>{membersCopy.columns.devices}</th>
                {p.canManage && <th className={HEAD}>{membersCopy.columns.actions}</th>}
              </tr>
            </thead>
            <tbody>
              {p.items.map((m) => (
                <MemberRow key={m.id} m={m} p={p} />
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {p.status === "ready" && p.hasMore && (
        <div>
          <Button variant="tonal" disabled={p.loadingMore} onClick={p.onLoadMore}>
            {p.loadingMore ? membersCopy.loadingMore : membersCopy.loadMore}
          </Button>
        </div>
      )}

      {p.invitations !== null && <PendingInvitations state={p.invitations} />}
    </div>
  );
}

function MemberRow({ m, p }: { m: MemberDto; p: MembersViewProps }) {
  const deactivated = m.status === "deactivated";
  const seatMore = moreCount(m.seatCount, m.seats.length);
  const deviceMore = m.deviceCount === null ? 0 : moreCount(m.deviceCount, m.devices.length);
  return (
    <tr
      className={`border-b border-outline-variant last:border-b-0 ${deactivated ? "opacity-60" : ""}`}
    >
      <td className={`${CELL} font-bold`}>
        <span className="flex items-center gap-2">
          <Avatar name={m.displayName} src={p.photoUrl?.(m) ?? null} size={32} />
          {m.displayName}
        </span>
      </td>
      <td className={`${CELL} break-all`}>{m.email ?? membersCopy.hiddenEmail}</td>
      <td className={CELL}>{m.employeeCode ?? membersCopy.noCode}</td>
      <td className={CELL}>
        {m.group ? (
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-full border border-outline-variant"
              style={{ backgroundColor: m.group.color }}
            />
            {m.group.name}
          </span>
        ) : (
          membersCopy.noGroup
        )}
      </td>
      <td className={CELL}>{membersCopy.statusLabels[m.status]}</td>
      <td className={CELL}>
        {m.seatCount}
        {m.seats.length > 0 && (
          <ul className={REFS}>
            {m.seats.map((s) => (
              <li key={s.id}>{s.code}</li>
            ))}
            {seatMore > 0 && <li>{membersCopy.moreRefs(seatMore)}</li>}
          </ul>
        )}
      </td>
      <td className={CELL}>
        {m.deviceCount === null ? (
          <>
            <span aria-hidden="true">{membersCopy.hiddenDevices}</span>
            <span className="sr-only">{membersCopy.hiddenDevicesLabel}</span>
          </>
        ) : (
          m.deviceCount
        )}
        {m.devices.length > 0 && (
          <ul className={REFS}>
            {m.devices.map((d) => (
              <li key={d.id}>{membersCopy.deviceRef(d.name, d.inventoryNumber, d.role)}</li>
            ))}
            {deviceMore > 0 && <li>{membersCopy.moreRefs(deviceMore)}</li>}
          </ul>
        )}
      </td>
      {p.canManage && (
        <td className={CELL}>
          <div className="flex items-center gap-2">
            <Button
              variant="tonal"
              size="sm"
              icon="edit"
              aria-label={membersCopy.editLabel(m.displayName)}
              onClick={() => p.onEdit(m)}
            >
              {membersCopy.edit}
            </Button>
            {deactivated ? (
              <Button
                variant="tonal"
                size="sm"
                aria-label={membersCopy.reactivateLabel(m.displayName)}
                onClick={() => p.onReactivate(m)}
              >
                {membersCopy.reactivate}
              </Button>
            ) : (
              <Button
                variant="danger"
                size="sm"
                aria-label={membersCopy.deactivateLabel(m.displayName)}
                onClick={() => p.onDeactivate(m)}
              >
                {membersCopy.deactivate}
              </Button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}
