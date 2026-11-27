"use client";

import { useEffect, useId, useRef } from "react";
import type { IconName } from "@/lib/icons";
import { Button } from "./Button";
import { kitCopy } from "./copy/kit";
import { Icon } from "./Icon";

/**
 * Reusable create/edit dialog shell on a native `<dialog>` (focus trap, Esc,
 * inert background and focus return come from the browser). Presentation-only:
 * the parent owns form state, submission and validation; this renders the
 * header, the supplied fields, an inline error line and the Cancel/Submit footer.
 */
export function EntityFormDialog({
  open,
  title,
  subtitle,
  submitLabel,
  cancelLabel = kitCopy.cancel,
  submitting = false,
  error,
  onClose,
  onSubmit,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  submitLabel: string;
  cancelLabel?: string;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedOnScrim = useRef(false);
  const titleId = useId();
  const subtitleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!open || !el) return;
    const previous = document.activeElement as HTMLElement | null;
    el.showModal();
    return () => {
      el.close();
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={subtitle ? subtitleId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onPointerDown={(e) => {
        pressedOnScrim.current = e.target === e.currentTarget;
      }}
      onPointerUp={(e) => {
        if (pressedOnScrim.current && e.target === e.currentTarget) onClose();
        pressedOnScrim.current = false;
      }}
      className="m-auto w-[calc(100%_-_2*var(--space-5))] max-w-md overflow-hidden rounded-2xl bg-surface p-0 text-text-primary shadow-dialog"
      style={{ animation: "popin var(--duration-ui) ease-out" }}
    >
      <div className="flex flex-col">
        <div className="px-6 pt-6 pb-3">
          <h2 id={titleId} className="text-subtitle text-text-primary">
            {title}
          </h2>
          {subtitle && (
            <p id={subtitleId} className="mt-1 text-label font-normal text-text-secondary">
              {subtitle}
            </p>
          )}
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3 px-6 pb-2">
          {children}

          {error && (
            <div role="alert" className="px-1 text-label text-danger">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 pb-4">
            <Button variant="tonal" onClick={onClose}>
              {cancelLabel}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? kitCopy.saving : submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

const FIELD_BOX =
  "field-box group flex min-h-control items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 transition-[color,background-color,border-color,box-shadow,transform] duration-(--duration-ui) ease-out";
const FIELD_CAPTION = "text-label text-text-primary";

/** Labelled text input. The wrapping `<label>` associates the caption with the input. */
export function DialogField({
  label,
  icon,
  ...rest
}: { label: string; icon: IconName } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1">
      <span className={FIELD_CAPTION}>{label}</span>
      <span className={FIELD_BOX}>
        <Icon name={icon} size={18} className="text-text-secondary" />
        <input
          className="flex-1 min-w-0 bg-transparent outline-none text-label text-text-primary placeholder:text-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
          {...rest}
        />
      </span>
    </label>
  );
}

/** Labelled select mirroring `DialogField`, for enum-ish fields. */
export function DialogSelect({
  label,
  icon,
  children,
  ...rest
}: { label: string; icon: IconName } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="flex flex-col gap-1">
      <span className={FIELD_CAPTION}>{label}</span>
      <span className={FIELD_BOX}>
        <Icon name={icon} size={18} className="text-text-secondary" />
        <select
          className="flex-1 min-w-0 bg-transparent outline-none text-label text-text-primary placeholder:text-text-secondary disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          {...rest}
        >
          {children}
        </select>
      </span>
    </label>
  );
}
