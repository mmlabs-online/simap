import type { ReactNode } from "react";
import type { MemberDto, MemberStatusFilter } from "@/lib/members/types";
import { apiErrorMessage } from "../copy/api";
import { membersCopy } from "../copy/members";
import { shellCopy } from "../copy/shell";
import { Avatar } from "../Avatar";
import { Button } from "../Button";
import { Card } from "../Card";
import { FilterChips, Pill } from "../Chip";
import { FilledInput } from "../FilledInput";
import { TABLE_CELL, TABLE_HEAD, TABLE_REFS, TABLE_ROW } from "../table";
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

/** The Members page body. Pure: data and handlers come from props. */
export function MembersView(p: MembersViewProps) {
  const filtered = p.searching || p.statusFilter !== "active";

  return (
    <div className="page-content flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-display text-text-primary">{shellCopy.pages.members.title}</h1>
        {p.headerAction}
      </div>
      <p className="text-label text-text-secondary">{membersCopy.accountsNote}</p>

      <div className="flex flex-wrap items-center gap-3">
        <FilledInput
          className="flex-1 min-w-56"
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
          <p role="alert" className="text-label font-semibold text-danger">
            {apiErrorMessage(p.errorCode ?? "internal")}
          </p>
          <Button variant="tonal" size="sm" onClick={p.onRetry}>
            {membersCopy.retry}
          </Button>
        </Card>
      )}

      {p.status === "ready" && p.items.length === 0 && (
        <Card className="px-6 py-12 text-center">
          <p className="text-label text-text-secondary">
            {filtered ? membersCopy.emptyFiltered : shellCopy.pages.members.empty}
          </p>
        </Card>
      )}

      {p.status === "ready" && p.items.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-224 border-collapse">
            <thead>
              <tr className="border-b border-divider">
                <th className={TABLE_HEAD}>{membersCopy.columns.name}</th>
                <th className={TABLE_HEAD}>{membersCopy.columns.email}</th>
                <th className={TABLE_HEAD}>{membersCopy.columns.code}</th>
                <th className={TABLE_HEAD}>{membersCopy.columns.group}</th>
                <th className={TABLE_HEAD}>{membersCopy.columns.status}</th>
                <th className={TABLE_HEAD}>{membersCopy.columns.seats}</th>
                <th className={TABLE_HEAD}>{membersCopy.columns.devices}</th>
                {p.canManage && <th className={TABLE_HEAD}>{membersCopy.columns.actions}</th>}
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
    <tr className={`${TABLE_ROW} ${deactivated ? "bg-canvas" : ""}`}>
      <td className={`${TABLE_CELL} font-semibold`}>
        <span className="flex items-center gap-2">
          <Avatar name={m.displayName} src={p.photoUrl?.(m) ?? null} size={32} />
          {m.displayName}
        </span>
      </td>
      <td className={`${TABLE_CELL} break-all`}>{m.email ?? membersCopy.hiddenEmail}</td>
      <td className={TABLE_CELL}>{m.employeeCode ?? membersCopy.noCode}</td>
      <td className={TABLE_CELL}>
        {m.group ? (
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-full border border-divider"
              style={{ backgroundColor: m.group.color }}
            />
            {m.group.name}
          </span>
        ) : (
          membersCopy.noGroup
        )}
      </td>
      <td className={TABLE_CELL}>
        <Pill
          dot
          tone={m.status === "active" ? "success" : "neutral"}
          label={membersCopy.statusLabels[m.status]}
        />
      </td>
      <td className={TABLE_CELL}>
        {m.seatCount}
        {m.seats.length > 0 && (
          <ul className={TABLE_REFS}>
            {m.seats.map((s) => (
              <li key={s.id}>{s.code}</li>
            ))}
            {seatMore > 0 && <li>{membersCopy.moreRefs(seatMore)}</li>}
          </ul>
        )}
      </td>
      <td className={TABLE_CELL}>
        {m.deviceCount === null ? (
          <>
            <span aria-hidden="true">{membersCopy.hiddenDevices}</span>
            <span className="sr-only">{membersCopy.hiddenDevicesLabel}</span>
          </>
        ) : (
          m.deviceCount
        )}
        {m.devices.length > 0 && (
          <ul className={TABLE_REFS}>
            {m.devices.map((d) => (
              <li key={d.id}>{membersCopy.deviceRef(d.name, d.inventoryNumber, d.role)}</li>
            ))}
            {deviceMore > 0 && <li>{membersCopy.moreRefs(deviceMore)}</li>}
          </ul>
        )}
      </td>
      {p.canManage && (
        <td className={TABLE_CELL}>
          <div className="flex flex-wrap items-center gap-2">
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
