import Link from "next/link";
import { saveErrorKind } from "@/lib/layout-editor/save-errors";
import { LAYOUT_LIMITS } from "@/lib/validate/layout";
import { Button } from "../Button";
import { apiErrorMessage } from "../copy/api";
import { roomlayoutCopy } from "../copy/roomlayout";
import { EntityFormDialog } from "../EntityFormDialog";
import type { EditorGate } from "./editor-page";
import type { EditorNotice } from "@/lib/layout-editor/editor-state";
import type { SaveDetail } from "@/lib/layout-editor/save-run";

const copy = roomlayoutCopy.editor;
const BOX = "flex max-w-xl flex-col items-start gap-3 rounded-md border border-divider p-4";
const LINK =
  "state-layer inline-flex min-h-control shrink-0 items-center justify-center rounded-lg border border-border bg-surface px-4 text-label text-text-primary hover:border-border-strong transition-[color,background-color,border-color,box-shadow,transform] duration-(--duration-ui) ease-out";

type GateProps = {
  gate: Exclude<EditorGate, "ready">;
  /** The room page, or `/rooms` when the room is unknown. */
  backHref: string;
  /** For the missing and error states. */
  onRetry?: () => void;
};

/** Every state of the editor page that is not the editor itself. */
export function EditorGateView({ gate, backHref, onRetry }: GateProps) {
  if (gate === "checking" || gate === "loading") {
    return (
      <p role="status" className="text-label font-normal text-text-secondary">
        {gate === "checking" ? copy.checking : copy.loading}
      </p>
    );
  }
  const text =
    gate === "not_allowed" ? (
      <>
        <h2 className="text-body font-semibold text-text-primary">{copy.notAllowed.title}</h2>
        <p className="text-label font-normal text-text-secondary">{copy.notAllowed.body}</p>
      </>
    ) : gate === "desktop" ? (
      <>
        <h2 className="text-body font-semibold text-text-primary">{copy.desktop.title}</h2>
        <p className="text-label font-normal text-text-secondary">{copy.desktop.body}</p>
      </>
    ) : gate === "read_only" ? (
      <p role="status" className="text-label font-normal text-text-primary">
        {copy.readOnly(LAYOUT_LIMITS.seats)}
      </p>
    ) : gate === "missing" ? (
      <p role="alert" className="text-label font-semibold text-danger">
        {copy.missing}
      </p>
    ) : (
      <p role="alert" className="text-label font-semibold text-danger">
        {copy.error}
      </p>
    );
  return (
    <div className={BOX}>
      {text}
      <div className="flex gap-2">
        {gate === "error" && onRetry && (
          <Button variant="tonal" size="sm" onClick={onRetry}>
            {copy.tryAgain}
          </Button>
        )}
        <Link href={backHref} className={LINK}>
          {backHref === "/rooms" ? copy.backToRooms : copy.backToRoom}
        </Link>
      </div>
    </div>
  );
}

type BannerProps = {
  code: string;
  detail?: SaveDetail;
  roomHref: string;
  onReload: () => void;
  onRetry: () => void;
};

/** A failed save. A conflict offers Reload, a transient failure offers Try again, a rule code offers nothing. */
export function SaveErrorBanner({ code, detail, roomHref, onReload, onRetry }: BannerProps) {
  const kind = saveErrorKind(code);
  const detailText = detail ? copy.saveDetail(detail) : "";
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 rounded-md border border-danger/40 p-3 text-label font-normal"
    >
      <p className="font-semibold text-danger">{copy.saveErrors[code] ?? apiErrorMessage(code)}</p>
      {detailText && <p className="text-text-secondary">{detailText}</p>}
      {kind === "conflict" && (
        <>
          <p className="text-text-secondary">{copy.conflictNote}</p>
          <Button variant="tonal" size="sm" onClick={onReload}>
            {copy.reload}
          </Button>
        </>
      )}
      {kind === "retry" && (
        <Button variant="tonal" size="sm" onClick={onRetry}>
          {copy.tryAgain}
        </Button>
      )}
      {(kind === "access" || kind === "gone") && (
        <Link href={roomHref} className={LINK}>
          {roomHref === "/rooms" ? copy.backToRooms : copy.backToRoom}
        </Link>
      )}
    </div>
  );
}

/** Asks before leaving with unsaved changes. */
export function LeaveDialog({
  open,
  onStay,
  onLeave,
}: {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
}) {
  return (
    <EntityFormDialog
      open={open}
      title={copy.leave.title}
      subtitle={copy.leave.body}
      submitLabel={copy.leave.leave}
      cancelLabel={copy.leave.stay}
      onClose={onStay}
      onSubmit={(e) => {
        e.preventDefault();
        onLeave();
      }}
    >
      {null}
    </EntityFormDialog>
  );
}

/** The one polite status line: the last refusal or the last done step. */
export function EditorStatusLine({ notice }: { notice: EditorNotice | null }) {
  const text =
    notice === null
      ? ""
      : notice.kind === "refused"
        ? copy.refused[notice.code]
        : notice.kind === "cleaned"
          ? copy.cleaned(notice.count)
          : copy.done[notice.what];
  return (
    <p role="status" className="min-h-5 text-label font-normal text-text-secondary">
      {text}
    </p>
  );
}
