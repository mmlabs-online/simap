"use client";

import { useEffect, useId, useRef } from "react";
import type { IconName } from "@/lib/icons";
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
      className="m-auto w-[calc(100%-2.5rem)] max-w-[440px] p-0 bg-surface-high text-on-surface rounded-md3-xl overflow-hidden shadow-[0_12px_40px_var(--shadow)]"
      style={{ animation: "popin .2s ease" }}
    >
      <div className="flex flex-col">
        <div className="px-6 pt-[22px] pb-3.5">
          <h2 id={titleId} className="text-[20px] font-extrabold text-on-surface">
            {title}
          </h2>
          {subtitle && (
            <p id={subtitleId} className="text-[13px] text-on-surface-variant font-medium mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3 px-6 pb-2">
          {children}

          {error && (
            <div role="alert" className="text-[13px] font-semibold text-error px-1">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 pb-4">
            <button
              type="button"
              onClick={onClose}
              className="state-layer px-5 py-2.5 rounded-md3 border border-outline text-on-surface font-bold text-sm cursor-pointer font-[inherit] hover:border-primary hover:text-primary"
            >
              {cancelLabel}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="state-layer px-5 py-2.5 rounded-md3 bg-primary text-on-primary font-bold text-sm cursor-pointer font-[inherit] disabled:opacity-40 disabled:pointer-events-none"
            >
              {submitting ? kitCopy.saving : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

const FIELD_BOX =
  "group flex items-center gap-2.5 rounded-md3 bg-surface px-3.5 h-11 border border-outline-variant focus-within:border-primary focus-within:shadow-[0_0_0_3px_var(--field-focus)] transition-[border-color,box-shadow] duration-150 ease-[cubic-bezier(0.2,0.7,0.2,1)]";
const FIELD_CAPTION =
  "text-[11px] font-extrabold tracking-[0.05em] uppercase text-on-surface-variant px-0.5";

/** Labelled text input. The wrapping `<label>` associates the caption with the input. */
export function DialogField({
  label,
  icon,
  ...rest
}: { label: string; icon: IconName } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={FIELD_CAPTION}>{label}</span>
      <span className={FIELD_BOX}>
        <Icon name={icon} size={18} className="text-on-surface-variant" />
        <input
          className="flex-1 min-w-0 bg-transparent outline-none text-sm font-medium text-on-surface placeholder:text-on-surface-variant disabled:opacity-60"
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
    <label className="flex flex-col gap-1.5">
      <span className={FIELD_CAPTION}>{label}</span>
      <span className={FIELD_BOX}>
        <Icon name={icon} size={18} className="text-on-surface-variant" />
        <select
          className="flex-1 min-w-0 bg-transparent outline-none text-sm font-medium text-on-surface disabled:opacity-60 cursor-pointer"
          {...rest}
        >
          {children}
        </select>
      </span>
    </label>
  );
}
