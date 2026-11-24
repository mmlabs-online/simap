import { EntityFormDialog } from "../EntityFormDialog";
import { CLIP } from "./SeatsView";

/** Shared confirm for Delete and Release. Cancel comes first, so it takes focus when the dialog opens. */
export function ConfirmSeatDialog({
  open,
  title,
  body,
  submitLabel,
  submitting,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  submitLabel: string;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <EntityFormDialog
      open={open}
      title={title}
      submitLabel={submitLabel}
      submitting={submitting}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        onConfirm();
      }}
    >
      <p className={`max-h-32 text-sm font-medium text-on-surface ${CLIP}`}>{body}</p>
    </EntityFormDialog>
  );
}
