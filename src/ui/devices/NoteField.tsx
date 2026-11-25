import { useId } from "react";
import { DEVICE_LIMITS } from "@/lib/devices/types";
import { devicesCopy } from "../copy/devices";
import { noteLength } from "./assign-device";

const CAPTION =
  "text-[11px] font-extrabold tracking-[0.05em] uppercase text-on-surface-variant px-0.5";
const HINT = "text-xs text-on-surface-variant px-0.5";

/** The note textarea with its label, hint and code point counter. Shared by assign and transfer. */
export function NoteField({
  value,
  onChange,
  label,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  hint: string;
}) {
  const noteId = useId();
  const hintId = useId();
  const countId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={noteId} className={CAPTION}>
        {label}
      </label>
      <textarea
        id={noteId}
        rows={3}
        value={value}
        maxLength={DEVICE_LIMITS.note}
        aria-describedby={`${hintId} ${countId}`}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md3 bg-surface px-3.5 py-2 border border-outline-variant focus:border-primary outline-none text-sm font-medium text-on-surface resize-y"
      />
      <span id={hintId} className={HINT}>
        {hint}
      </span>
      <span id={countId} className={HINT}>
        {devicesCopy.assign.noteCount(noteLength(value), DEVICE_LIMITS.note)}
      </span>
    </div>
  );
}
