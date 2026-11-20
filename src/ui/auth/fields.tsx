"use client";

import type { ReactNode } from "react";
import type { IconName } from "@/lib/icons";
import { authCopy } from "../copy/auth";
import { FilledInput } from "../FilledInput";

export function Notice({
  kind,
  busy,
  children,
}: {
  kind: "error" | "info";
  busy?: boolean;
  children: ReactNode;
}) {
  const tone =
    kind === "error"
      ? "border-error/40 bg-error-container text-on-error-container"
      : "border-outline-variant bg-surface-container text-on-surface";
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      aria-busy={busy ? true : undefined}
      className={`rounded-md3 border p-3 text-sm ${tone}`}
    >
      <p className="break-words">{children}</p>
    </div>
  );
}

export const linkClass = "self-center text-sm font-semibold text-on-surface underline";

export function Field({
  id,
  label,
  icon,
  error,
  onChange,
  ...input
}: {
  id: string;
  label: string;
  icon: IconName;
  error?: string;
  onChange: (value: string) => void;
  type: string;
  autoComplete: string;
  value: string;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-on-surface-variant">
        {label}
      </label>
      <FilledInput
        id={id}
        icon={icon}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
        {...input}
      />
      {error && (
        <small id={errorId} className="text-xs text-error">
          {error}
        </small>
      )}
    </div>
  );
}

export function ShowPasswordToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-[44px] items-center gap-2 text-xs text-on-surface-variant">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {authCopy.fields.showPassword}
    </label>
  );
}
