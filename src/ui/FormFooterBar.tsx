import { Button } from "./Button";
import { Icon } from "./Icon";

export type FooterStatus = {
  tone: "saved" | "dirty" | "busy" | "error";
  text: string;
  detail?: string;
};

/** Save status on the left, Cancel and a submit Save on the right. In flow, not sticky. Copy-free. */
export function FormFooterBar({
  status,
  cancelLabel,
  saveLabel,
  busyLabel,
  canCancel,
  canSave,
  busy,
  onCancel,
}: {
  status: FooterStatus;
  cancelLabel: string;
  saveLabel: string;
  busyLabel: string;
  canCancel: boolean;
  canSave: boolean;
  busy: boolean;
  onCancel: () => void;
}) {
  const isError = status.tone === "error";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-4">
      <p
        role={isError ? "alert" : "status"}
        className={[
          "flex items-center gap-2 text-label font-semibold",
          isError ? "text-danger" : "text-text-primary",
        ].join(" ")}
      >
        {status.tone === "saved" && <Icon name="check" size={18} className="text-success" />}
        <span>{status.text}</span>
        {status.detail && <span className="font-normal text-text-secondary">{status.detail}</span>}
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="tonal" disabled={!canCancel || busy} onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button type="submit" icon="check" disabled={!canSave || busy}>
          {busy ? busyLabel : saveLabel}
        </Button>
      </div>
    </div>
  );
}
