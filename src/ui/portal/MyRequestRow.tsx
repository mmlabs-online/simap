import type { MyRequestDto } from "@/lib/requests/types";
import { Button } from "../Button";
import { Pill } from "../Chip";
import { portalCopy } from "../copy/portal";
import { requestsCopy } from "../copy/requests";
import { Icon } from "../Icon";
import { formatRequestTime } from "../requests/requests-state";
import { requestStatusLook } from "./my-requests";

const ICON_TONES = {
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning",
  danger: "bg-danger-tint text-danger",
  neutral: "bg-canvas text-text-secondary",
} as const;

/** One seat request row: status icon, seat line, status pill, times and Cancel on pending. Pure. */
export function MyRequestRow({
  item,
  isNew,
  cancellingId,
  onCancel,
}: {
  item: MyRequestDto;
  isNew: boolean;
  cancellingId: string | null;
  onCancel: (item: MyRequestDto) => void;
}) {
  const t = portalCopy.seat;
  const look = requestStatusLook(item.status);
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:px-5">
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${ICON_TONES[look.tone]}`}
      >
        <Icon name={look.icon} size={20} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1 break-words">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-label font-normal text-text-primary">
            <strong className="font-semibold">{t.requestSeat(item.seat.code)}</strong>{" "}
            {t.requestRoom(item.seat.roomCode)}
          </span>
          <Pill dot tone={look.tone} label={requestsCopy.statusLabel[item.status]} />
          {isNew && <Pill tone="accent" label={requestsCopy.mine.newChip} />}
        </div>
        <p className="text-caption text-text-secondary">
          <time dateTime={item.createdAt}>
            {requestsCopy.requestedAt(formatRequestTime(item.createdAt))}
          </time>
        </p>
        {item.status !== "pending" && item.decidedAt !== null && (
          <p className="text-caption text-text-secondary">
            <time dateTime={item.decidedAt}>
              {requestsCopy.decidedLine(
                item.status,
                item.decidedBy?.displayName ?? null,
                formatRequestTime(item.decidedAt),
              )}
            </time>
          </p>
        )}
      </div>
      {item.status === "pending" && (
        <Button
          variant="outlined"
          size="sm"
          className="self-start"
          disabled={cancellingId !== null}
          onClick={() => onCancel(item)}
        >
          {cancellingId === item.id ? requestsCopy.mine.cancelling : requestsCopy.mine.cancel}
        </Button>
      )}
    </li>
  );
}
